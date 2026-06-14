import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, validateCheckout } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

function parseSSE(text: string): Record<string, unknown> {
  const match = text.match(/^data:\s*(.+)$/m);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch { return {}; }
}

async function getSession(): Promise<string> {
  const r = await fetch(MCP, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'initialize',
      params: { protocolVersion: '2024-11-05', clientInfo: { name: 'tara', version: '1.0' }, capabilities: {} },
    }),
  });
  const sid = r.headers.get('mcp-session-id');
  await r.text();
  if (!sid) throw new Error('No MCP session');
  return sid;
}

// Parse order confirmation — MCP may return JSON or Markdown prose
function parseOrderResponse(raw: string): {
  orderId?: string; checkoutUrl?: string; error?: string;
} {
  console.log('[order parse] raw:', raw.slice(0, 400));

  // ── JSON response ────────────────────────────────────────────────────────
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    // Explicit error fields
    if (j.error && typeof j.error === 'string') return { error: j.error };
    if (j.success === false && j.message)        return { error: String(j.message) };
    // Success fields
    const ref = String(j.order_ref ?? j.orderId ?? j.id ?? '');
    const url = String(j.checkout_url ?? j.checkoutUrl ?? j.url ?? '');
    if (ref || url) return { orderId: ref || undefined, checkoutUrl: url || undefined };
  } catch { /* not JSON — fall through */ }

  // ── Markdown/text response ───────────────────────────────────────────────
  // Extract order reference
  const orderRef =
    raw.match(/order[\s_-]*(?:ref(?:erence)?|id|number)[:\s#*]+([A-Z0-9\-]{4,30})/i)?.[1] ??
    raw.match(/\b(KAP?[0-9]{4,}[A-Z0-9]*)\b/i)?.[1] ??
    raw.match(/\b([A-Z]{2,4}[0-9]{6,})\b/)?.[1];

  // Extract checkout URL
  const checkoutUrl =
    raw.match(/https?:\/\/[^\s)"'<>]*(?:checkout|pay|cart)[^\s)"'<>]*/i)?.[0] ??
    raw.match(/https?:\/\/(?:www\.)?kapruka\.com\/[^\s)"'<>]+/i)?.[0];

  // Only treat as error if clearly an error — not just because the word "error" appears
  const isExplicitError = /^(?:error|failed|invalid|sorry|unable|could not|not found)/i.test(raw.trim()) ||
    /order\s+(?:could not|failed|was not|cannot)\s+be\s+(?:placed|created|processed)/i.test(raw);

  if (isExplicitError && !orderRef) {
    return { error: 'Order rejected by Kapruka — please check your details.' };
  }

  // We have at least some useful info — return it
  if (orderRef || checkoutUrl) {
    return {
      orderId:     orderRef,
      checkoutUrl: checkoutUrl ?? 'https://www.kapruka.com/shops/cart/',
    };
  }

  // Ambiguous response — assume placed, redirect to Kapruka cart
  console.warn('[order parse] ambiguous response, redirecting to cart');
  return { checkoutUrl: 'https://www.kapruka.com/shops/cart/' };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const validationError = validateCheckout(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const {
    items, giftMessage, deliveryDate, district,
    recipient, sender, locationType, deliveryType,
  } = body as {
    items:        { id: string; qty?: number; quantity?: number }[];
    giftMessage?: string;
    deliveryDate: string;
    district:     string;
    locationType?: string;
    deliveryType?: string;
    recipient:    { name: string; phone: string; address?: string };
    sender?:      { name: string };
  };

  const isPickup = deliveryType === 'pickup';

  // ASCII-sanitize free-text — Kapruka backend is Latin-1
  const clean = (s: string, max = 100) =>
    String(s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

  const cleanGiftMessage = giftMessage
    ? clean(giftMessage, 300) || null
    : null;

  // MCP only accepts: apartment | house | office | other
  const LOCATION_MAP: Record<string, string> = {
    'HOUSE OR RESIDENCE':       'house',
    'APARTMENT':                'apartment',
    'OFFICE':                   'office',
    'HOSPITAL':                 'other',
    'SCHOOL':                   'other',
    'FUNERAL HOME':             'other',
    'WEDDING RECEPTION':        'other',
    'OTHER (INCLUDING HOTELS)': 'other',
    'OTHER':                    'other',
    'PICKUP':                   'other',
  };

  const locationTypeValue = isPickup
    ? 'other'
    : (LOCATION_MAP[String(locationType ?? '').toUpperCase()] ?? 'house');

  try {
    const sid = await getSession();

    const orderParams: Record<string, unknown> = {
      cart: items.map(i => ({
        product_id: String(i.id).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80),
        quantity:   Math.min(Math.max(1, Math.floor(Number(i.qty ?? i.quantity ?? 1))), 99),
      })),
      recipient: {
        name:  clean(recipient.name, 80),
        phone: String(recipient.phone).replace(/[\s\-]/g, '').slice(0, 20),
      },
      delivery: {
        address:       clean(recipient.address ?? district, 250),
        city:          clean(district, 100),
        date:          deliveryDate,
        location_type: locationTypeValue,
      },
      sender: {
        name: clean(sender?.name ?? 'Guest', 80) || 'Guest',
      },
      currency: 'LKR',
    };

    // Only include gift_message if non-empty
    if (cleanGiftMessage) orderParams.gift_message = cleanGiftMessage;

    console.log('[checkout params]', JSON.stringify(orderParams).slice(0, 500));

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '2', method: 'tools/call',
        params: { name: 'kapruka_create_order', arguments: { params: orderParams } },
      }),
    });

    const text = await r.text();
    console.log('[checkout MCP raw]', text.slice(0, 600));

    const data = parseSSE(text) as {
      result?: { content?: { text?: string }[] };
      error?:  { message?: string };
    };

    if (data?.error) {
      console.error('[checkout MCP error]', JSON.stringify(data.error));
      return NextResponse.json({ error: 'Kapruka could not process the order.' }, { status: 502 });
    }

    const raw = data?.result?.content?.[0]?.text ?? '';
    if (!raw) {
      console.error('[checkout] empty response. Full SSE:', text.slice(0, 400));
      return NextResponse.json({ error: 'No response from Kapruka.' }, { status: 502 });
    }

    const { orderId, checkoutUrl, error: orderError } = parseOrderResponse(raw);

    if (orderError) {
      return NextResponse.json({ error: orderError }, { status: 400 });
    }

    return NextResponse.json({
      success:     true,
      orderId:     orderId ?? 'ORDER',
      checkoutUrl: checkoutUrl ?? 'https://www.kapruka.com/shops/cart/',
    });

  } catch (err) {
    console.error('[checkout error]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Checkout unavailable. Please try again.' }, { status: 500 });
  }
}
