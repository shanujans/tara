import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// Allow all *.kapruka.com subdomains — partnercentral is their vendor image CDN, not an auth wall.
// The content-type check below is the real protection against forwarding HTML error pages.
const ALLOWED_HOST = /^https?:\/\/(?:[\w.-]+\.)?kapruka\.com\//;
const IMAGE_EXT    = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i;
const IMAGE_PATH   = /productImages|\/images\/|\/photos\//i;
const IMAGE_CT     = /^image\//i;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 200, 60_000)) {
    return new Response('Rate limited', { status: 429 });
  }

  const raw = new URL(req.url).searchParams.get('url') ?? '';
  let target: string;
  try { target = decodeURIComponent(raw); } catch { target = raw; }

  if (!target || !ALLOWED_HOST.test(target) ||
      (!IMAGE_EXT.test(target) && !IMAGE_PATH.test(target))) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const r = await fetch(target, {
      headers: {
        'Referer':       'https://www.kapruka.com/',
        'Origin':        'https://www.kapruka.com',
        'User-Agent':    'Mozilla/5.0 (compatible; Kapruka-TARA/1.0)',
        'Accept':        'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!r.ok) return new Response('Image not found', { status: r.status });

    const ct = r.headers.get('content-type') ?? '';

    // Reject HTML auth-walls that slip through with a 200 status
    if (!IMAGE_CT.test(ct)) {
      return new Response('Not an image', { status: 422 });
    }

    const buffer = await r.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':                ct,
        'Cache-Control':               'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('img proxy error:', e);
    return new Response('Proxy error', { status: 502 });
  }
}
