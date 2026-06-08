import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, validateCheckout } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

function parseSSE(text: string): Record<string, unknown> {
  const match = text.match(/^data:\s*(.+)$/m);
  if (!match) return {};
  return JSON.parse(match[1]);
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
  if (!sid) throw new Error('No session');
  return sid;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429 });
  }

  // Parse JSON safely
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Centralised validation (implemented in @/lib/security)
  const validationError = validateCheckout(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { items, giftMessage, deliveryDate, district, recipient, sender } = body as {
    items: { id: string; qty: number }[];
    giftMessage?: string;
    deliveryDate: string;
    district: string;
    recipient: { name: string; phone: string; address?: string };
    sender?: { name: string };
  };

  try {
    const sid = await getSession();

    // Sanitise inputs before sending to MCP
    const orderParams = {
      cart: items.map(i => ({
        product_id: String(i.id).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80),
        quantity: Math.min(Math.max(1, Math.floor(Number(i.qty ?? 1))), 99),
      })),
      recipient: {
        name: String(recipient.name).slice(0, 80),
        phone: String(recipient.phone).replace(/\s/g, '').slice(0, 20),
      },
      delivery: {
        address: String(recipient.address ?? district).slice(0, 250),
        city: String(district).slice(0, 100),
        date: deliveryDate,
        location_type: 'house',
      },
      sender: {
        name: String(sender?.name ?? 'TARA Customer').slice(0, 80),
        anonymous: false,
      },
      gift_message: giftMessage ? String(giftMessage).slice(0, 300) : null,
      currency: 'LKR',
      response_format: 'json',
    };

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '2', method: 'tools/call',
        params: { name: 'kapruka_create_order', arguments: { params: orderParams } },
      }),
    });

    const text = await r.text();
    const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
    const raw = data?.result?.content?.[0]?.text;
    if (!raw) throw new Error('Empty response');

    const parsed = JSON.parse(raw);
    if (parsed.error || (typeof parsed === 'string' && parsed.startsWith('Error'))) {
      return NextResponse.json({ error: 'Order failed. Please check your details.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      orderId: parsed.order_ref,
      checkoutUrl: parsed.checkout_url,
      total: parsed.summary?.grand_total,
    });
  } catch {
    // Generic error – don't leak internal details
    return NextResponse.json({ error: 'Checkout unavailable. Please try again.' }, { status: 500 });
  }
}