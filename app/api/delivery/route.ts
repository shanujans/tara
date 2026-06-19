import { cacheGet, cacheSet, cacheKey, TTL } from '@/lib/cache';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { checkDelivery } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 60, 60_000)) {
    return NextResponse.json({ available: false, message: 'Rate limited' }, { status: 429 });
  }
  let body: { city?: string; delivery_date?: string; product_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ available: false }, { status: 400 });
  }
  const { city, delivery_date, product_id } = body;
  if (!city || !delivery_date) {
    return NextResponse.json({ available: false, message: 'city and delivery_date required' }, { status: 400 });
  }

  const dKey = cacheKey('delivery', city.toLowerCase(), delivery_date, product_id ?? '');
  const dHit = cacheGet<Record<string, unknown>>(dKey);
  if (dHit) {
    console.log('[cache HIT] delivery:', city, delivery_date);
    return NextResponse.json(dHit);
  }

  try {
    const result = await checkDelivery({
      city: city.slice(0, 100),
      delivery_date,
      ...(product_id ? { product_id: product_id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80) } : {}),
    });
    cacheSet(dKey, result, TTL.DELIVERY);
    console.log('[cache SET] delivery:', body.city, body.delivery_date);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ available: false, message: 'Could not check delivery' });
  }
}
