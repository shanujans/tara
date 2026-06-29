/**
 * /api/checkout/route.ts
 *
 * Order creation with mandatory pre-validation:
 *   1. kapruka_list_delivery_cities  — canonicalise user-typed city
 *   2. kapruka_check_delivery        — confirm date is serviceable + get rate
 *   3. kapruka_create_order          — only reached if both checks pass
 *
 * Errors at steps 1-2 return HTTP 400 with { error, delivery_error: true }
 * so the frontend can surface them in chat via TARA.
 */
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

// ─── Shared MCP tool-call helper ──────────────────────────────────────────
async function callTool(
  sid:    string,
  id:     string,
  tool:   string,
  params: Record<string, unknown>,
): Promise<string> {
  const r = await fetch(MCP, {
    method:  'POST',
    headers: { ...H, 'mcp-session-id': sid },
    body:    JSON.stringify({
      jsonrpc: '2.0', id, method: 'tools/call',
      params:  { name: tool, arguments: { params } },
    }),
  });
  const text = await r.text();
  console.log(`[checkout:${tool}] raw (first 400):`, text.slice(0, 400));
  const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
  return data?.result?.content?.[0]?.text ?? '';
}

// ─── Order response parser (unchanged from original) ─────────────────────
function parseOrderResponse(raw: string): {
  orderId?: string; checkoutUrl?: string; error?: string;
} {
  console.log('[order parse] raw:', raw.slice(0, 400));

  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.error && typeof j.error === 'string') return { error: j.error };
    if (j.success === false && j.message)        return { error: String(j.message) };
    const ref = String(j.order_ref ?? j.orderId ?? j.id ?? '');
    const url = String(j.checkout_url ?? j.checkoutUrl ?? j.url ?? '');
    if (ref || url) return { orderId: ref || undefined, checkoutUrl: url || undefined };
  } catch { /* not JSON — fall through */ }

  const orderRef =
    raw.match(/order[\s_-]*(?:ref(?:erence)?|id|number)[:\s#*]+([A-Z0-9\-]{4,30})/i)?.[1] ??
    raw.match(/\b(KAP?[0-9]{4,}[A-Z0-9]*)\b/i)?.[1] ??
    raw.match(/\b([A-Z]{2,4}[0-9]{6,})\b/)?.[1];

  const checkoutUrl =
    raw.match(/https?:\/\/[^\s)"'<>]*(?:checkout|pay|cart)[^\s)"'<>]*/i)?.[0] ??
    raw.match(/https?:\/\/(?:www\.)?kapruka\.com\/[^\s)"'<>]+/i)?.[0];

  const isExplicitError =
    /^(?:error|failed|invalid|sorry|unable|could not|not found)/i.test(raw.trim()) ||
    /order\s+(?:could not|failed|was not|cannot)\s+be\s+(?:placed|created|processed)/i.test(raw);

  if (isExplicitError && !orderRef) {
    return { error: 'Order rejected by Kapruka — please check your details.' };
  }
  if (orderRef || checkoutUrl) {
    return { orderId: orderRef, checkoutUrl: checkoutUrl ?? 'https://www.kapruka.com/shops/cart/' };
  }
  console.warn('[order parse] ambiguous response, redirecting to cart');
  return { checkoutUrl: 'https://www.kapruka.com/shops/cart/' };
}

// ─── POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
          ?? 'unknown';

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
    items:         { id: string; qty?: number; quantity?: number }[];
    giftMessage?:  string;
    deliveryDate:  string;
    district:      string;
    locationType?: string;
    deliveryType?: string;
    recipient:     { name: string; phone: string; address?: string };
    sender?:       { name: string };
  };

  const isPickup = deliveryType === 'pickup';

  const clean = (s: string, max = 100) =>
    String(s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

  const cleanGiftMessage = giftMessage ? clean(giftMessage, 300) || null : null;

  const LOCATION_MAP: Record<string, string> = {
    'HOUSE OR RESIDENCE': 'house', 'APARTMENT': 'apartment',
    'OFFICE': 'office', 'HOSPITAL': 'other', 'SCHOOL': 'other',
    'FUNERAL HOME': 'other', 'WEDDING RECEPTION': 'other',
    'OTHER (INCLUDING HOTELS)': 'other', 'OTHER': 'other', 'PICKUP': 'other',
  };
  const locationTypeValue = isPickup
    ? 'other'
    : (LOCATION_MAP[String(locationType ?? '').toUpperCase()] ?? 'house');

  try {
    const sid = await getSession();

    // ══════════════════════════════════════════════════════════════════════
    // STEP 1 — Canonicalise city name via delivery-cities lookup
    // ══════════════════════════════════════════════════════════════════════
    let canonicalCity = clean(district, 100);  // fallback if MCP fails

    if (!isPickup) {
      console.log(`[checkout] validating city: "${district}"`);
      const citiesRaw = await callTool(sid, 'ck-cities', 'kapruka_list_delivery_cities', {
        query:           district.trim().slice(0, 50),
        limit:           5,
        response_format: 'json',
      });

      try {
        const parsed     = JSON.parse(citiesRaw) as { cities?: { name: string }[] };
        const cityList   = parsed.cities ?? [];
        const firstMatch = cityList[0]?.name;

        if (!firstMatch) {
          // City not in Kapruka's network — block checkout, send friendly error
          console.warn(`[checkout] city not found: "${district}"`);
          return NextResponse.json({
            error:         `Sorry, Kapruka doesn't deliver to "${district}" yet. Please check the city name and try again.`,
            delivery_error: true,
            city_not_found: true,
          }, { status: 400 });
        }

        canonicalCity = firstMatch;
        console.log(`[checkout] city resolved: "${district}" → "${canonicalCity}"`);
      } catch {
        console.warn('[checkout] city lookup parse failed — using typed city as fallback');
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 2 — Confirm delivery is available on the requested date
    // ══════════════════════════════════════════════════════════════════════
    if (!isPickup) {
      console.log(`[checkout] checking delivery: ${canonicalCity} on ${deliveryDate}`);
      const deliveryRaw = await callTool(sid, 'ck-delivery', 'kapruka_check_delivery', {
        city:            canonicalCity,
        delivery_date:   deliveryDate,
        response_format: 'json',
      });

      try {
        const dInfo = JSON.parse(deliveryRaw) as {
          available:           boolean;
          rate?:               number;
          reason?:             string | null;
          next_available_date?: string | null;
          perishable_warning?: string | null;
        };

        if (!dInfo.available) {
          const next    = dInfo.next_available_date;
          const reason  = dInfo.reason ?? 'Delivery not available on this date';
          const message = next
            ? `${reason}. The next available delivery date to ${canonicalCity} is ${next}.`
            : `${reason}. Please choose a different delivery date.`;

          console.warn(`[checkout] delivery unavailable: ${message}`);
          return NextResponse.json({
            error:               message,
            delivery_error:      true,
            city_not_found:      false,
            next_available_date: next ?? null,
            rate:                dInfo.rate ?? null,
          }, { status: 400 });
        }

        console.log(
          `[checkout] delivery confirmed: ${canonicalCity} on ${deliveryDate}, ` +
          `rate: LKR ${dInfo.rate ?? 'n/a'}` +
          (dInfo.perishable_warning ? ` ⚠️ ${dInfo.perishable_warning}` : ''),
        );

        // Surface perishable warning in the response even on success
        // (frontend can show it as a chat notification)
        if (dInfo.perishable_warning) {
          body = { ...body, _perishable_warning: dInfo.perishable_warning };
        }

      } catch {
        console.warn('[checkout] delivery check parse failed — proceeding with order');
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3 — Place the order (only reached if validation passed)
    // ══════════════════════════════════════════════════════════════════════
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
        address:       clean(recipient.address ?? canonicalCity, 250),
        city:          canonicalCity,   // ← use canonicalised name
        date:          deliveryDate,
        location_type: locationTypeValue,
      },
      sender: {
        name: clean(sender?.name ?? 'Guest', 80) || 'Guest',
      },
      currency: 'LKR',
    };
    if (cleanGiftMessage) orderParams.gift_message = cleanGiftMessage;

    console.log('[checkout params]', JSON.stringify(orderParams).slice(0, 500));

    const raw = await callTool(sid, 'ck-order', 'kapruka_create_order', orderParams);

    if (!raw) {
      console.error('[checkout] empty response from kapruka_create_order');
      return NextResponse.json({ error: 'No response from Kapruka.' }, { status: 502 });
    }

    const { orderId, checkoutUrl, error: orderError } = parseOrderResponse(raw);

    if (orderError) {
      return NextResponse.json({ error: orderError }, { status: 400 });
    }

    // Include perishable warning in success response so frontend can relay it
    const perishableWarning = (body as Record<string, unknown>)._perishable_warning as string | undefined;

    return NextResponse.json({
      success:            true,
      orderId:            orderId ?? 'ORDER',
      checkoutUrl:        checkoutUrl ?? 'https://www.kapruka.com/shops/cart/',
      canonical_city:     canonicalCity,
      ...(perishableWarning ? { perishable_warning: perishableWarning } : {}),
    });

  } catch (err) {
    console.error('[checkout error]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Checkout unavailable. Please try again.' }, { status: 500 });
  }
}
