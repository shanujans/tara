import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { items, giftMessage, deliveryDate, district, total } = await req.json();

  if (!items?.length)    return NextResponse.json({ error: 'Empty cart' }, { status: 400 });
  if (!district)         return NextResponse.json({ error: 'Select district' }, { status: 400 });
  if (!deliveryDate)     return NextResponse.json({ error: 'Select delivery date' }, { status: 400 });

  // Forward to Kapruka MCP
  try {
    const r = await fetch(process.env.MCP_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'create_order',
        params: { items, giftMessage, deliveryDate, district, total },
      }),
    });
    const data = await r.json();
    return NextResponse.json({ success: true, orderId: data.order_id ?? data.id ?? 'ORD-DEMO' });
  } catch {
    // Demo fallback
    return NextResponse.json({ success: true, orderId: `ORD-${Date.now()}` });
  }
}