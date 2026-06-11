import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// Only proxy public www.kapruka.com image paths.
// partnercentral.kapruka.com requires vendor auth — never proxy those.
const ALLOWED_HOST  = /^https?:\/\/(?:www\.)?kapruka\.com\//;
const BLOCKED_HOSTS = /partnercentral\.|partner\.|admin\.|cms\./i;
const IMAGE_EXT     = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i;
const IMAGE_PATH    = /productImages|\/images\/|\/photos\//i;
const IMAGE_CT      = /^image\//i;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 120, 60_000)) {
    return new Response('Rate limited', { status: 429 });
  }

  const raw = new URL(req.url).searchParams.get('url') ?? '';

  let target: string;
  try { target = decodeURIComponent(raw); } catch { target = raw; }

  // Hard block vendor portal — return 403 immediately so browser uses CSS fallback
  if (!target || BLOCKED_HOSTS.test(target)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Must be a www.kapruka.com image URL
  if (!ALLOWED_HOST.test(target) || (!IMAGE_EXT.test(target) && !IMAGE_PATH.test(target))) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const r = await fetch(target, {
      headers: {
        // Spoof Referer so Kapruka's hotlink protection passes the request
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

    // ── Critical: reject HTML auth walls that return 200 ──────────────────
    // If the server returned HTML instead of an image, we must NOT forward it —
    // a browser img tag receiving text/html fires onError, but the wrong content-type
    // confuses some clients. Return 422 so callers know to use the CSS fallback.
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
        'X-Proxy-Source':              'tara-img',
      },
    });
  } catch (e) {
    console.error('img proxy error:', e);
    return new Response('Proxy error', { status: 502 });
  }
}