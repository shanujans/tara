import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { cacheGet, cacheSet, cacheKey, TTL } from '@/lib/cache';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// Returns true if URL is a product image path (not a product page)
function isImageUrl(url: string): boolean {
  return /productImages|\/images\/|\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url);
}

// Build a best-effort product page URL from whatever we have
function buildProductUrl(candidates: string[], id: string, name: string): string {
  // Prefer non-image Kapruka URLs
  const pageUrl = candidates.find(u => u.includes('kapruka.com') && !isImageUrl(u));
  if (pageUrl) return pageUrl;
  // Relative path fallback
  const relative = candidates.find(u => u.startsWith('/') && !isImageUrl(u));
  if (relative) return `https://www.kapruka.com${relative}`;
  // Name-based search fallback (actually opens a real page)
  if (name) return `https://www.kapruka.com/products/?q=${encodeURIComponent(name)}`;
  // Ultimate fallback
  return 'https://www.kapruka.com';
}

function parseMarkdownProduct(md: string, productId: string) {
  const name     = md.match(/^##\s+(.+)/m)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const price    = Number(md.match(/\*\*Price\*\*[^:]*:\s*LKR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
  const stock    = md.match(/\*\*Stock\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const category = md.match(/\*\*Category\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const vendor   = md.match(/\*\*Vendor\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const weight   = md.match(/\*\*Weight\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const rating   = md.match(/\*\*Rating\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';

  // ── URL extraction: collect all Kapruka URLs, skip image paths ──────────
  const allUrls = [...md.matchAll(/https?:\/\/(?:www\.)?kapruka\.com[^\s)\]"'\\<>]*/g)]
    .map(m => m[0]);

  // Also check for explicit URL field (e.g. **URL**: https://...)
  const explicitUrl = md.match(/\*\*(?:URL|Link|Product\s*URL)\*\*[^:]*:\s*(https?:\/\/\S+)/i)?.[1];
  if (explicitUrl) allUrls.unshift(explicitUrl);

  const url = buildProductUrl(allUrls, productId, name);

  // ── Image extraction: collect every image URL in the markdown ──────────
  const rawImgUrls: string[] = [];

  // 1. Markdown image syntax  ![alt](url)
  for (const m of md.matchAll(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/g))
    rawImgUrls.push(m[1].trim());

  // 2. Labelled fields: **Image**, **Image 2**, **Photo**, **Gallery** etc.
  for (const m of md.matchAll(/\*\*(?:Image|Photo|Gallery|Thumbnail)\s*\d*[^:]*\*\*[^:]*:\s*(https?:\/\/[^\s)\]"'\\<>]+)/gi))
    rawImgUrls.push(m[1].trim());

  // 3. Any URL ending in an image extension anywhere in the text
  for (const m of md.matchAll(/https?:\/\/[^\s)"'\\<>]+\.(?:jpg|jpeg|png|webp|gif|avif)(?:[?#][^\s)"'\\<>]*)?/gi))
    rawImgUrls.push(m[0].replace(/[.,;:!?)\]]+$/, ''));

  // Deduplicate, preserve order, cap at 10
  const seenI = new Set<string>();
  const uniqueImgs: string[] = [];
  for (const u of rawImgUrls)
    if (!seenI.has(u)) { seenI.add(u); uniqueImgs.push(u); }

  const imgInMd    = uniqueImgs[0] ?? allUrls.find(isImageUrl) ?? '';
  const allImgsArr = uniqueImgs.length ? uniqueImgs.slice(0, 10)
                   : imgInMd ? [imgInMd] : [];

  const desc = md.match(/\*\*(?:Description|Summary)\*\*[^:]*:\s*([\s\S]+?)(?=\n\*\*|\n##|$)/i)?.[1]?.trim() ?? '';

  const shipping = [
    vendor && `Sold by ${vendor}`,
    weight && weight !== '0 lb' && `Weight: ${weight}`,
    rating && `Rating: ${rating}`,
  ].filter(Boolean).join(' · ');

  return {
    id:          productId,
    name:        name || `Product ${productId}`,
    price,
    in_stock:    /in.?stock/i.test(stock),
    stock,
    category,
    shipping:    shipping || undefined,
    url,
    image:       imgInMd,
    image_url:   imgInMd,
    images:      allImgsArr,
    description: desc || (category ? `${category} product${vendor ? ` by ${vendor}` : ''}` : undefined),
  };
}

/* ── Normalise a JSON product response from Kapruka MCP ─────────────────
   When response_format:"json" is set, the MCP returns a structured object
   whose "images" array contains ALL product images. We deduplicate and cap. */
function normalizeJsonProduct(p: Record<string, unknown>, pid: string): Record<string, unknown> {
  /* Coerce any value to a plain string — Kapruka JSON returns object fields like
     category: { id, name, slug, path }  instead of plain strings.
     React cannot render objects as children, so every text field must go through this. */
  const str = (v: unknown, fallback = ''): string => {
    if (v == null) return fallback;
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // Kapruka wraps categories/vendors as { id, name, slug, path }
      return String(o.name ?? o.title ?? o.label ?? o.value ?? o.id ?? fallback).trim();
    }
    return String(v);
  };

  // ── Collect every image URL ──────────────────────────────────────────────
  const srcs: string[] = [];

  for (const k of ['image', 'image_url', 'thumbnail', 'thumb', 'photo']) {
    const v = p[k];
    if (typeof v === 'string' && v.startsWith('http')) srcs.push(v);
  }

  const imgs = p.images;
  if (Array.isArray(imgs)) {
    for (const img of imgs) {
      if (typeof img === 'string' && img.startsWith('http'))
        srcs.push(img);
      else if (img && typeof img === 'object') {
        const obj = img as Record<string, unknown>;
        const u = obj.url ?? obj.src ?? obj.image ?? '';
        if (typeof u === 'string' && u.startsWith('http')) srcs.push(u);
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const u of srcs) { if (!seen.has(u)) { seen.add(u); unique.push(u); } }

  // ── URL ───────────────────────────────────────────────────────────────────
  let url = typeof p.url === 'string' ? p.url : '';
  if (!url) {
    const name = str(p.name);
    url = name
      ? `https://www.kapruka.com/products/?q=${encodeURIComponent(name)}`
      : 'https://www.kapruka.com';
  }

  // ── Price — may be number, string, or { amount, currency } ───────────────
  let price = 0;
  if (typeof p.price === 'number') price = p.price;
  else if (typeof p.price === 'string') price = Number(p.price.replace(/[^0-9.]/g, ''));
  else if (p.price && typeof p.price === 'object') {
    const po = p.price as Record<string, unknown>;
    price = Number(po.amount ?? po.value ?? po.lkr ?? 0);
  }

  // ── Shipping / vendor line ────────────────────────────────────────────────
  const vendor  = str(p.vendor ?? p.seller ?? p.brand);
  const weight  = str(p.weight);
  const rating  = str(p.rating);
  const shipping = str(p.shipping)
    || [
        vendor  && `Sold by ${vendor}`,
        weight  && weight !== '0 lb' && `Weight: ${weight}`,
        rating  && `Rating: ${rating}`,
      ].filter(Boolean).join(' · ');

  return {
    /* Spread safe scalars from original; override anything that might be an object */
    ...Object.fromEntries(
      Object.entries(p).filter(([, v]) =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v == null
      )
    ),
    id:          pid,
    name:        str(p.name),
    price,
    in_stock:    !!(p.in_stock === true || /in.?stock/i.test(str(p.stock))),
    stock:       str(p.stock),
    category:    str(p.category),          /* was arriving as { id,name,slug,path } */
    vendor,
    description: str(p.description ?? p.summary),
    shipping:    shipping || undefined,
    url,
    image:       unique[0] ?? '',
    image_url:   unique[0] ?? '',
    images:      unique.slice(0, 10),
  };
}
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 120, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  let body: { product_id?: string; name?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { product_id, name: hintName } = body;
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 });

  const safeId = product_id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);
  const key = cacheKey('product', safeId);
  const hit = cacheGet<Record<string, unknown>>(key);
  if (hit) { console.log('[cache HIT] product:', safeId); return NextResponse.json({ product: hit }); }

  try {
    const sid = await mcpSession();

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: String(Date.now()),
        method: 'tools/call',
        params: {
          name: 'kapruka_get_product',
          /* response_format:"json" → returns full images array, not just thumbnail */
          arguments: { params: { product_id: safeId, currency: 'LKR', response_format: 'json' } },
        },
      }),
    });

    const text = await r.text();
    const m    = text.match(/^data:\s*(.+)$/m);
    const json = m ? m[1] : text;

    let raw = '';
    try {
      const data = JSON.parse(json) as { result?: { content?: { text?: string }[] } };
      raw = data?.result?.content?.[0]?.text ?? '';
    } catch {
      // MCP parse error — try search fallback before giving up
      console.warn(`[product] ${safeId} → MCP parse error, trying search fallback`);
    }

    // Check if get_product returned an error or empty/garbage response
    const isError = !raw || /error executing tool|validation error|not found|Error/i.test(raw);
    const isGarbage = raw && !raw.includes('"name"') && !raw.includes('## ') && raw.length < 50;

    let product: Record<string, unknown> | null = null;

    if (!isError && !isGarbage) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        product = normalizeJsonProduct(parsed, safeId);
        cacheSet(key, product, TTL.PRODUCT);
        console.log(`[product] ${safeId} → JSON, ${(product.images as string[]).length} image(s)`);
      } catch {
        product = parseMarkdownProduct(raw, safeId) as Record<string, unknown>;
        console.log(`[product] ${safeId} → Markdown, ${((product.images as string[]) ?? []).length} image(s)`);
      }
    }

    // ── FALLBACK: search by product NAME to get brief details ──────────────
    // When get_product fails (CATSYM ID, delisted, parse error, garbage),
    // use kapruka_search_products with the product NAME (passed by client)
    // to find the product in search results. Only match by exact product ID
    // to avoid returning the wrong product.
    if (!product && hintName) {
      console.log(`[product] ${safeId} → trying search fallback with name: "${hintName}"`);
      try {
        // Use the product name as the search query — NOT the product ID
        const searchQ = hintName.slice(0, 80);

        const sr = await fetch(MCP, {
          method: 'POST',
          headers: { ...H, 'mcp-session-id': sid },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: String(Date.now() + 1),
            method: 'tools/call',
            params: {
              name: 'kapruka_search_products',
              arguments: { params: { q: searchQ, limit: 10, response_format: 'json', in_stock_only: false } },
            },
          }),
        });

        const sText = await sr.text();
        const sMatch = sText.match(/^data:\s*(.+)$/m);
        const sJson = sMatch ? sMatch[1] : sText;
        const sData = JSON.parse(sJson) as { result?: { content?: { text?: string }[] } };
        const sRaw = sData?.result?.content?.[0]?.text ?? '';

        if (sRaw) {
          try {
            const sParsed = JSON.parse(sRaw) as { results?: Array<Record<string, unknown>> };
            const results = sParsed.results ?? [];

            // ONLY match by exact product ID — never use first result as fallback
            // This prevents showing "LED Fog Light" when user clicked "iPhone 16 Pro"
            const match = results.find(r => String(r.id ?? '') === safeId);

            if (match) {
              const mName = String(match.name ?? match.id ?? `Product ${safeId}`);
              const mPrice = match.price && typeof match.price === 'object'
                ? Number((match.price as Record<string, unknown>).amount ?? 0)
                : Number(match.price ?? 0);
              const imageUrl = String(match.image_url ?? '');
              const productUrl = String(match.url ?? '');
              const mCategory = match.category && typeof match.category === 'object'
                ? String((match.category as Record<string, unknown>).name ?? '')
                : String(match.category ?? '');
              const mInStock = Boolean(match.in_stock ?? true);

              product = {
                id: safeId,
                name: mName,
                price: mPrice,
                in_stock: mInStock,
                stock: mInStock ? 'In Stock' : 'Out of Stock',
                category: mCategory,
                url: productUrl || `https://www.kapruka.com/products/?q=${encodeURIComponent(mName)}`,
                image: imageUrl,
                image_url: imageUrl,
                images: imageUrl ? [imageUrl] : [],
                description: `${mCategory} product available on Kapruka. Tap "View on Kapruka" for full details.`,
                summary: `${mCategory} product. Price: LKR ${mPrice.toLocaleString('si-LK')}.`,
              };

              cacheSet(key, product, TTL.SEARCH);
              console.log(`[product] ${safeId} → search fallback OK: "${mName}" LKR ${mPrice}`);
            } else {
              console.log(`[product] ${safeId} → search fallback: ID not found in ${results.length} results`);
            }
          } catch {
            console.warn(`[product] ${safeId} → search fallback parse failed`);
          }
        }
      } catch (searchErr) {
        console.warn(`[product] ${safeId} → search fallback error:`, searchErr);
      }
    }

    if (product) {
      cacheSet(key, product, TTL.PRODUCT);
      return NextResponse.json({ product });
    }

    return NextResponse.json({ error: 'Could not fetch product' }, { status: 500 });
  } catch (e) {
    console.error('getProduct error:', e);
    return NextResponse.json({ error: 'Could not fetch product' }, { status: 500 });
  }
}
