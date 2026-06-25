import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeProduct } from '@/lib/security';
import { cacheGet, cacheSet, cacheKey, TTL } from '@/lib/cache';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

/** URLs that belong to gated portals requiring authentication — never usable as public images */
const GATED  = /partnercentral\.|partner\.|admin\.|cms\./i;
const IS_IMG = (u: string) =>
  /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u) ||
  /productImages|\/images\/|\/photos\//i.test(u);

/**
 * Parses Markdown‑formatted search results returned by the MCP.
 * Extracts product blocks that look like:
 * **1. Product Name** ... ID: xxx ... Price: LKR 1,234 ... URL ... Image ... Category
 */
function parseMarkdownSearch(md: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  const blocks = md.split(/(?=\*\*\d+\.\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/^\*\*\d+\.\s+(.+?)\*\*/);
    if (!nameMatch) continue;

    const name = nameMatch[1].replace(/`/g, '').trim();

    // ── Collect ALL URLs in this block (any domain) ───────────────────────
    const rawUrls = new Set<string>();

    // 1. Explicit markdown image syntax  ![alt](url)
    for (const m of block.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)) {
      rawUrls.add(m[1].trim());
    }
    // 2. Any bare URL
    for (const m of block.matchAll(/https?:\/\/[^\s)"'\]\\<>]+/g)) {
      rawUrls.add(m[0].replace(/[.,;:!?)\]]+$/, '')); // trim trailing punctuation
    }

    const allUrls = [...rawUrls];

    // ── Classify ──────────────────────────────────────────────────────────
    // Prefer public www.kapruka.com image URLs; fall back to vendor CDN (partnercentral)
    // Both go through /api/img proxy which adds the correct Referer header.
    const imgUrl = allUrls.find(u => IS_IMG(u) && !GATED.test(u))  // public first
                ?? allUrls.find(u => IS_IMG(u))                      // vendor CDN fallback
                ?? '';

    // Product page: kapruka.com URL that isn't an image path
    const productUrl = allUrls.find(
      u => !GATED.test(u) && !IS_IMG(u) && u.includes('kapruka.com'),
    ) ?? '';

    const idMatch    = block.match(/[-–*]\s*ID[:\s]+`?([A-Za-z0-9_\-]+)`?/i);
    const priceMatch = block.match(/(?:Price|LKR)[:\s]*(?:LKR\s*)?([\d,]+)/i);
    const catMatch   = block.match(/Category[:\s]+(.+?)(?:\n|$)/i);

    products.push({
      id:        idMatch?.[1] ?? `mk_${Date.now()}_${products.length}`,
      name,
      price:     priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : 0,
      url:       productUrl,
      image_url: imgUrl,
      category:  catMatch?.[1]?.trim() ?? '',
      in_stock:  true,
    });
  }
  return products;
}

async function mcpSearch(q: string, sid: string, maxPrice?: number, limit = 16): Promise<Record<string, unknown>[]> {
  const key = cacheKey('search', q, maxPrice, limit);
  const hit  = cacheGet<Record<string, unknown>[]>(key);
  if (hit) { console.log('[cache HIT] search:', q); return hit; }

  const args: Record<string, unknown> = {
    q: q.slice(0, 100), limit, currency: 'LKR',
    sort: 'relevance',
  };
  if (maxPrice) args.max_price = maxPrice;

  const r = await fetch(MCP, {
    method: 'POST',
    headers: { ...H, 'mcp-session-id': sid },
    body: JSON.stringify({
      jsonrpc: '2.0', id: String(Date.now()), method: 'tools/call',
      params: { name: 'kapruka_search_products', arguments: { params: args } },
    }),
  });

  const text = await r.text();
  const m    = text.match(/^data:\s*(.+)$/m);
  const json = m ? m[1] : text;

  try {
    const data = JSON.parse(json) as { result?: { content?: { text?: string }[] } };
    const raw  = data?.result?.content?.[0]?.text ?? '';
    try {
      const parsed = JSON.parse(raw);
      const result = (parsed.results || parsed.products || []) as Record<string, unknown>[];
      cacheSet(key, result, TTL.SEARCH);
      return result;
    } catch {
      const result = parseMarkdownSearch(raw);
      if (result.length) cacheSet(key, result, TTL.SEARCH);
      return result;
    }
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 30, 60_000)) return NextResponse.json({ products: [] }, { status: 429 });

  let body: { primary?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ products: [] }); }

  const { primary } = body;
  if (!primary || primary.length < 2) return NextResponse.json({ products: [] });

  const parts     = primary.split('|');
  const baseQuery = parts[0].trim();
  const maxPrice  = primary.match(/max_price:(\d+)/)?.[1]
    ? Number(primary.match(/max_price:(\d+)/)![1]) : undefined;

  const words = baseQuery.split(' ').filter(w => w.length > 2);
  const q2    = words.length >= 3 ? words.slice(0, 2).join(' ') : '';

  /* ── Keyword visibility log ────────────────────────────────── */
  console.log(
    `\n🔍 TARA → Kapruka search` +
    `\n   primary  : "${baseQuery}"` +
    (q2        ? `\n   secondary: "${q2}"` : '') +
    (maxPrice  ? `\n   maxPrice : LKR ${maxPrice}` : '') +
    `\n`
  );

  try {
    // Sequential — MCP sessions are SSE-based and don't support concurrent requests on the same sid
    const sid = await mcpSession();
    const r1  = await mcpSearch(baseQuery, sid, maxPrice, 16);
    const r2  = q2 && q2 !== baseQuery ? await mcpSearch(q2, sid, maxPrice, 8) : [];

    const seen = new Set<string>();
    const products = [...r1, ...r2]
      .map(sanitizeProduct)
      .filter(p => {
        if (!p.id || !p.name || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 20);

    return NextResponse.json({ products, quantum: products.length > 0 });
  } catch (e) {
    console.error('Search error:', e);
    return NextResponse.json({ products: [], quantum: false });
  }
}