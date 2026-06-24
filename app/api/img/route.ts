import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const ALLOWED_HOST = /^https?:\/\/(?:[\w.-]+\.)?kapruka\.com\//;
const IMAGE_EXT    = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i;
const IMAGE_PATH   = /productImages|\/images\/|\/photos\/|\/assets\/images\//i;
const IMAGE_CT     = /^image\//i;

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  retries = 1,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      return r;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 600));
    }
  }
  throw new Error('unreachable');
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 200, 60_000)) return new Response('Rate limited', { status: 429 });

  const raw = new URL(req.url).searchParams.get('url') ?? '';
  let target: string;
  try { target = decodeURIComponent(raw); } catch { target = raw; }

  if (!target || !ALLOWED_HOST.test(target) || (!IMAGE_EXT.test(target) && !IMAGE_PATH.test(target))) {
    return new Response('Forbidden', { status: 403 });
  }

  /* partnercentral.kapruka.com requires its own Referer header */
  const isPartner = target.includes('partnercentral.kapruka.com');

  const headers: Record<string, string> = {
    'Referer':       isPartner ? 'https://partnercentral.kapruka.com/' : 'https://www.kapruka.com/',
    'Origin':        isPartner ? 'https://partnercentral.kapruka.com' : 'https://www.kapruka.com',
    'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':        'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    ...(isPartner ? { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' } : {}),
  };

  try {
    const r = await fetchWithRetry(target, headers, isPartner ? 12_000 : 8_000, 1);

    if (!r.ok) return new Response('Image not found', { status: r.status });

    const ct = r.headers.get('content-type') ?? '';
    if (!IMAGE_CT.test(ct)) return new Response('Not an image', { status: 422 });

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
