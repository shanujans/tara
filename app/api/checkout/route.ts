import { NextRequest, NextResponse } from 'next/server';

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
  const { items, giftMessage, deliveryDate, district, recipient, sender } = await req.json();

  if (!items?.length)   return NextResponse.json({ error: 'Empty cart' }, { status: 400 });
  if (!district)        return NextResponse.json({ error: 'Select district' }, { status: 400 });
  if (!deliveryDate)    return NextResponse.json({ error: 'Select delivery date' }, { status: 400 });
  if (!recipient?.name) return NextResponse.json({ error: 'Recipient name required' }, { status: 400 });
  if (!recipient?.phone)return NextResponse.json({ error: 'Recipient phone required' }, { status: 400 });

  try {
    const sid = await getSession();

    const orderParams = {
      cart: items.map((i: { id: string; qty: number }) => ({
        product_id: i.id,
        quantity: i.qty ?? 1,
      })),
      recipient: {
        name: recipient.name,
        phone: recipient.phone,
      },
      delivery: {
        address: recipient.address ?? district,
        city: district,
        date: deliveryDate,
        location_type: 'house',
      },
      sender: {
        name: sender?.name ?? 'TARA Customer',
        anonymous: false,
      },
      gift_message: giftMessage || null,
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
    if (!raw) throw new Error('Empty MCP response');

    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(parsed.error);

    return NextResponse.json({
      success: true,
      orderId: parsed.order_ref,
      checkoutUrl: parsed.checkout_url,
      total: parsed.summary?.grand_total,
    });
  } catch (e) {
    console.error('Checkout error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}