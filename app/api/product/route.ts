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
  if (typeof p.price === 'number') {
    price = p.price;
  } else if (typeof p.price === 'string') {
    price = Number(p.price.replace(/[^0-9.]/g, ''));
  } else if (p.price && typeof p.price === 'object') {
    const po = p.price as Record<string, unknown>;
    const pCurrency = String(po.currency ?? '').trim().toUpperCase();
    // Only accept the price when it is LKR. The MCP may return a USD price
    // object (e.g. { amount: 674.07, currency: "USD" }) for some products
    // even when currency:"LKR" was requested — using it would show a wrong
    // "Rs." price. Setting price=0 lets the UI merge the search-result LKR price.
    if (pCurrency === '' || pCurrency === 'LKR' || pCurrency === 'RS' || pCurrency === 'RS.') {
      price = Number(po.amount ?? po.value ?? po.lkr ?? 0);
    }
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

/* ── Structured extraction from MCP response (Markdown or JSON) ────────────
   Follows the user's schema. Zero extra calls — parses what we already have. */
function extractStructuredProduct(raw: string, productId: string): Record<string, unknown> | null {
  if (!raw || raw.length < 20) return null;

  const str = (v: unknown, fallback = ''): string => {
    if (v == null) return fallback;
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return String(o.name ?? o.title ?? o.label ?? o.value ?? o.id ?? fallback).trim();
    }
    return String(v);
  };

  // ── Try JSON first ────────────────────────────────────────────────────────
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch { /* not JSON, fall through to markdown */ }

  // Helper to extract from either parsed JSON or raw markdown
  const getField = (obj: Record<string, unknown> | null, keys: string[], mdPatterns: RegExp[]): string => {
    // Try JSON object
    if (obj) {
      for (const k of keys) {
        const v = obj[k];
        if (v != null && String(v).trim()) return str(v);
      }
    }
    // Try markdown patterns
    for (const re of mdPatterns) {
      const m = raw.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return '';
  };

  // ── Basic Info ────────────────────────────────────────────────────────────
  const name = getField(parsed, ['name', 'title', 'product_name'], [
    /^##\s+(.+)/m,
    /\*\*Name\*\*[^:]*:\s*(.+)/i,
  ]);

  const priceStr = getField(parsed, ['price', 'amount', 'selling_price', 'lkr'], [
    /\*\*Price\*\*[^:]*:\s*LKR\s*([\d,]+)/i,
    /\*\*Price\*\*[^:]*:\s*Rs\.?\s*([\d,]+)/i,
    /Price[:\s]+(?:LKR|Rs\.?)?\s*([\d,]+)/i,
  ]);
  const price = Number(priceStr.replace(/,/g, '')) || 0;

  const currency = getField(parsed, ['currency'], [/LKR|Rs\.?/i]) || 'LKR';

  const stockRaw = getField(parsed, ['stock', 'stock_status', 'availability', 'in_stock'], [
    /\*\*Stock\*\*[^:]*:\s*(.+)/i,
    /\*\*Availability\*\*[^:]*:\s*(.+)/i,
  ]);
  const availability = stockRaw || 'Unknown';

  const brand_or_merchant = getField(parsed, ['vendor', 'seller', 'brand', 'merchant', 'manufacturer'], [
    /\*\*Vendor\*\*[^:]*:\s*(.+)/i,
    /\*\*Sold by\*\*[^:]*:\s*(.+)/i,
    /\*\*Brand\*\*[^:]*:\s*(.+)/i,
  ]);

  const warranty_or_guarantee = getField(parsed, ['warranty', 'guarantee', 'return_policy'], [
    /\*\*Warranty\*\*[^:]*:\s*(.+)/i,
    /\*\*Guarantee\*\*[^:]*:\s*(.+)/i,
    /\*\*Return\*\*[^:]*:\s*(.+)/i,
    /return.*policy[:\s]+(.+)/i,
  ]);

  // ── Key Highlights & Specs ───────────────────────────────────────────────
  const description = getField(parsed, ['description', 'summary', 'short_description'], [
    /\*\*(?:Description|Summary)\*\*[^:]*:\s*([\s\S]+?)(?=\n\*\*|\n##|$)/i,
  ]);

  const specifications: string[] = [];
  const specFields = ['specifications', 'specs', 'features', 'details', 'technical_specifications'];
  if (parsed) {
    for (const k of specFields) {
      const v = parsed[k];
      if (Array.isArray(v)) {
        for (const item of v) specifications.push(str(item));
      } else if (typeof v === 'string' && v.trim()) {
        specifications.push(...v.split('\n').map(s => s.trim()).filter(Boolean));
      } else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        for (const [sk, sv] of Object.entries(o)) {
          if (sv != null) specifications.push(`${sk}: ${str(sv)}`);
        }
      }
    }
  }
  // Extract from markdown tables/lists
  const specMatches = raw.matchAll(/\*\*([^*]+)\*\*[^:]*:\s*(.+)/g);
  for (const m of specMatches) {
    const label = m[1].trim();
    const value = m[2].trim();
    if (label && value && !/price|stock|category|vendor|brand|warranty|guarantee|return|description|summary|image|url|link|rating|weight|shipping/i.test(label)) {
      specifications.push(`${label}: ${value}`);
    }
  }

  // ── Promotional & Transactional Info ─────────────────────────────────────
  const payment_options = getField(parsed, ['payment_options', 'installments', 'bnpl', 'card_offers'], [
    /installment|emi|bnpl|buy.now.pay.later|card.discount|0%/i,
  ]);

  const shipping_info = getField(parsed, ['shipping', 'delivery', 'shipping_info', 'delivery_info'], [
    /\*\*Shipping\*\*[^:]*:\s*(.+)/i,
    /\*\*Delivery\*\*[^:]*:\s*(.+)/i,
    /deliver(y|ed)\s+(within|in|on)\s+[\d\w\s]+/i,
  ]);

  // ── Social Proof & Discovery ─────────────────────────────────────────────
  const ratingStr = getField(parsed, ['rating', 'average_rating', 'stars'], [
    /\*\*Rating\*\*[^:]*:\s*([\d.]+)/i,
  ]);
  const rating_score = ratingStr ? Number(ratingStr) : null;

  const review_count_str = getField(parsed, ['review_count', 'reviews', 'ratings_count'], [
    /\*\*Reviews?\*\*[^:]*:\s*(\d+)/i,
    /\((\d+)\s*reviews?\)/i,
  ]);
  const review_count = review_count_str ? Number(review_count_str) : null;

  // ── URL & Images ─────────────────────────────────────────────────────────
  const allUrls: string[] = [];
  // From JSON
  if (parsed) {
    for (const k of ['url', 'link', 'product_url', 'permalink']) {
      const v = parsed[k];
      if (typeof v === 'string' && v.startsWith('http')) allUrls.push(v);
    }
  }
  // From markdown
  for (const m of raw.matchAll(/https?:\/\/(?:www\.)?kapruka\.com[^\s)\]"'\\<>]*/g)) {
    allUrls.push(m[0]);
  }

  // Filter out image URLs
  const isImg = (u: string) => /productImages|\/images\/|\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u);
  const pageUrl = allUrls.find(u => !isImg(u)) ?? `https://www.kapruka.com/products/?q=${encodeURIComponent(name)}`;

  const rawImgUrls: string[] = [];
  if (parsed?.images && Array.isArray(parsed.images)) {
    for (const img of parsed.images) {
      if (typeof img === 'string' && img.startsWith('http')) rawImgUrls.push(img);
      else if (img && typeof img === 'object') {
        const u = (img as Record<string, unknown>).url ?? (img as Record<string, unknown>).src ?? '';
        if (typeof u === 'string' && u.startsWith('http')) rawImgUrls.push(u);
      }
    }
  }
  for (const m of raw.matchAll(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/g)) rawImgUrls.push(m[1].trim());
  for (const m of raw.matchAll(/https?:\/\/[^\s)"'\\<>]+\.(?:jpg|jpeg|png|webp|gif|avif)(?:[?#][^\s)"'\\<>]*)?/gi)) rawImgUrls.push(m[0].replace(/[.,;:!?)\]]+$/, ''));

  const seenI = new Set<string>();
  const uniqueImgs: string[] = [];
  for (const u of rawImgUrls) if (!seenI.has(u)) { seenI.add(u); uniqueImgs.push(u); }

  const mainImage = uniqueImgs[0] ?? '';

  // ── Category ──────────────────────────────────────────────────────────────
  const category = getField(parsed, ['category', 'category_name', 'type'], [
    /\*\*Category\*\*[^:]*:\s*(.+)/i,
  ]);

  // ── Build result following the schema ─────────────────────────────────────
  if (!name) return null; // Must have at least a name

  return {
    // Basic Info
    title: name,
    price,
    currency,
    availability: /in.?stock/i.test(availability) ? true : (availability || null),
    brand_or_merchant: brand_or_merchant || null,
    warranty_or_guarantee: warranty_or_guarantee || null,

    // Key Highlights & Specs
    description: description || (category ? `${category} product${brand_or_merchant ? ` by ${brand_or_merchant}` : ''}` : null),
    specifications: specifications.length > 0 ? specifications.slice(0, 15) : null,

    // Promotional & Transactional
    payment_options: payment_options || null,
    shipping_info: shipping_info || null,

    // Social Proof & Discovery
    rating_score,
    review_count,
    related_items: null, // Not available from single product response

    // Extras for our UI
    id: productId,
    in_stock: /in.?stock/i.test(availability),
    stock: availability,
    category,
    vendor: brand_or_merchant,
    url: pageUrl,
    image: mainImage,
    image_url: mainImage,
    images: uniqueImgs.slice(0, 10),
  };
}

/* ── Fetch Kapruka product page HTML and extract structured data ────────────
   Uses the product URL from search results to fetch the actual Kapruka page.
   Parses JSON-LD (Schema.org/Product), meta tags, and HTML elements.
   5-second timeout — never blocks the response. Zero external dependencies. */
async function fetchKaprukaPage(
  pageUrl: string,
  fallbackName: string,
  fallbackPrice: number,
  fallbackImage: string,
  fallbackCategory: string,
  fallbackInStock: boolean,
  safeId: string,
): Promise<Record<string, unknown> | null> {
  if (!pageUrl || !pageUrl.startsWith('http')) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const html = await res.text();
    if (!html || html.length < 200) return null;

    // ── Helper: strip HTML tags ──────────────────────────────────────────────
    const stripTags = (s: string): string =>
      s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;/gi, "'")
       .replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();

    // ── Helper: decode HTML entities for text ────────────────────────────────
    const decodeHtml = (s: string): string =>
      s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"');

    // ── 1. Try JSON-LD (Schema.org/Product) — most reliable ──────────────────
    let ldData: Record<string, unknown> | null = null;
    const ldMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ldMatches) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const type = (item as Record<string, unknown>)['@type'];
          if (typeof type === 'string' && /product/i.test(type)) {
            ldData = item as Record<string, unknown>;
            break;
          }
          // Check @graph array
          const graph = (item as Record<string, unknown>)['@graph'];
          if (Array.isArray(graph)) {
            for (const g of graph) {
              const gt = (g as Record<string, unknown>)['@type'];
              if (typeof gt === 'string' && /product/i.test(gt)) {
                ldData = g as Record<string, unknown>;
                break;
              }
            }
          }
          if (ldData) break;
        }
        if (ldData) break;
      } catch { /* invalid JSON-LD — skip */ }
    }

    // ── 2. Extract from meta tags ────────────────────────────────────────────
    const getMeta = (prop: string): string => {
      // Match content="..." or content='...' — non-greedy, handles both quote types
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
      if (m) return decodeHtml(m[1]).trim();
      // Try reversed attribute order: content before property/name
      const m2 = html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
      return m2 ? decodeHtml(m2[1]).trim() : '';
    };

    // ── 3. Extract from HTML elements ────────────────────────────────────────
    const getEl = (selector: RegExp): string => {
      const m = html.match(selector);
      return m ? stripTags(m[1]).trim() : '';
    };

    // ── Build the structured product following the schema ────────────────────

    // Basic Info
    let title = '';
    let price = 0;
    let currency = 'LKR';
    let availability: boolean | string = '';
    let brand = '';
    let warranty = '';

    if (ldData) {
      title = String(ldData.name ?? '').trim();
      const ldPrice = ldData.offers as Record<string, unknown> | undefined;
      if (ldPrice) {
        const ldCurrency = String(ldPrice.priceCurrency ?? '').trim().toUpperCase();
        // Only trust the JSON-LD price when it is explicitly LKR.
        // Kapruka's international pages often expose a USD price in JSON-LD,
        // which would otherwise leak through as the displayed "Rs." price.
        if (ldCurrency === 'LKR' || ldCurrency === 'RS' || ldCurrency === 'RS.') {
          price = Number(ldPrice.price ?? ldPrice.lowPrice ?? 0) || 0;
          currency = 'LKR';
        } else {
          // Non-LKR (often USD) structured price — ignore it so the
          // LKR-based fallbacks below (meta tags, HTML scan, search price) win.
          currency = 'LKR';
        }
        availability = String(ldPrice.availability ?? '');
      }
      brand = String((ldData.brand as Record<string, unknown> | undefined)?.name ?? ldData.brand ?? '').trim();
    }

    // Fallback to meta tags
    if (!title) title = getMeta('og:title') || getEl(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || getMeta('twitter:title');
    if (!title) title = fallbackName;

    if (!price) {
      const metaPrice = getMeta('product:price:amount');
      const metaCurrency = (getMeta('product:price:currency') || getMeta('og:price:currency') || '').trim().toUpperCase();
      // Only trust the meta price when it is explicitly LKR.
      // On Kapruka's international pages (served to US/overseas IPs like Vercel),
      // product:price:amount is a USD value — accepting it would leak a wrong "Rs." price.
      if (metaPrice && (metaCurrency === 'LKR' || metaCurrency === 'RS' || metaCurrency === 'RS.')) {
        price = Number(metaPrice.replace(/[^0-9.]/g, '')) || 0;
      }
    }
    if (!price) {
      // Try common Kapruka price patterns in HTML — this regex only matches
      // prices explicitly prefixed with LKR or Rs. so USD values are skipped.
      // Collect ALL matches and pick the largest, because the first "Rs." in
      // the HTML may be a variant/storage label (e.g. "Rs. 256" from "256GB")
      // rather than the actual product price.
      const priceMatches = [...html.matchAll(/(?:LKR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/gi)];
      let scrapedPrice = 0;
      for (const pm of priceMatches) {
        const v = Number(pm[1].replace(/,/g, '')) || 0;
        if (v > scrapedPrice) scrapedPrice = v;
      }
      // Only use the scraped price if it's plausible relative to the search
      // result price (fallbackPrice). If the scraped price is less than 10%
      // of fallbackPrice it's almost certainly a false match (e.g. a storage
      // number like 256 leaking through as "Rs. 256").
      if (scrapedPrice && fallbackPrice > 0 && scrapedPrice < fallbackPrice * 0.1) {
        console.log(`[product] ${safeId} → scraped Rs.${scrapedPrice} implausible vs search ${fallbackPrice}, ignoring`);
        scrapedPrice = 0;
      }
      if (scrapedPrice) price = scrapedPrice;
    }
    if (!price) price = fallbackPrice;

    if (!availability) {
      const metaAvail = getMeta('product:availability');
      availability = metaAvail || '';
    }
    if (!availability) {
      if (/in.?stock|available/i.test(html)) availability = 'In Stock';
      else if (/out.?of.?stock|unavailable|sold.?out/i.test(html)) availability = 'Out of Stock';
    }
    if (!availability) availability = fallbackInStock ? 'In Stock' : 'Unknown';

    if (!brand) brand = getMeta('product:brand') || '';
    if (!brand) brand = fallbackCategory;

    // Partner/Seller — Kapruka shows "Kapruka Partner: CELLTRONICS" on product pages
    const partnerMatch = html.match(/(?:kapruka\s+partner|sold\s+by|seller|vendor|merchant)[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,60})/i)
      || html.match(/(?:kapruka\s+partner|sold\s+by|seller|vendor|merchant)[:\s]*([^<\n]{2,60})/i);
    if (partnerMatch) {
      const partnerName = partnerMatch[1].trim().replace(/['"]/g, '');
      if (partnerName && partnerName.length > 1 && partnerName.length < 50) {
        brand = partnerName;
      }
    }

    // Stock level detail — "Last X remaining", "Only X left", etc.
    const stockLevelMatch = html.match(/<(?:p|span|div|li|td|small)[^>]*>\s*(?:last|only)\s+(\d+)\s+(?:remaining|left|available|in\s+stock)\s*<\/(?:p|span|div|li|td|small)>/i)
      || html.match(/(?:last|only)\s+(\d+)\s+(?:remaining|left|available)/i);
    if (stockLevelMatch) {
      availability = `In Stock (Last ${stockLevelMatch[1]} remaining)`;
    }

    // Warranty — scan for warranty/return text in visible elements only
    const warrantyMatch = html.match(/<(?:p|span|div|li|td)[^>]*>\s*(?:warranty|guarantee|return\s+policy)[^<]*<\/(?:p|span|div|li|td)>/i);
    if (warrantyMatch) warranty = stripTags(warrantyMatch[0]).trim().slice(0, 80);

    // Key Highlights & Specs
    let description = '';
    if (ldData?.description) {
      description = String(ldData.description).trim();
    }
    if (!description) description = getMeta('og:description') || getMeta('description');
    if (!description) {
      description = getEl(/<(?:div|p)[^>]*(?:class|id)=["'][^"']*(?:description|product-detail|product-desc|summary)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i);
    }
    // Clean description — strip any residual HTML/meta fragments
    description = description
      .replace(/content=["'][^"']*["']/gi, '')
      .replace(/\/?>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!description || description.length < 10) description = `${fallbackCategory} product from Kapruka.`;

    // Specifications — extract from tables, lists, and definition lists
    const specifications: string[] = [];

    // From <table> elements
    const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
    for (const tm of tableMatches) {
      const rows = [...tm[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const row of rows) {
        const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        if (cells.length >= 2) {
          const label = stripTags(cells[0][1]).trim();
          const value = stripTags(cells[1][1]).trim();
          if (label && value && label.length < 50 && value.length < 100) {
            specifications.push(`${label}: ${value}`);
          }
        }
      }
    }

    // From <li> elements inside spec/feature lists
    const listMatches = [...html.matchAll(/<(?:ul|ol)[^>]*(?:class|id)=["'][^"']*(?:spec|feature|detail|attribute|info)[^"']*["'][^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi)];
    for (const lm of listMatches) {
      const items = [...lm[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const item of items) {
        const text = stripTags(item[1]).trim();
        if (text && text.length < 120) specifications.push(text);
      }
    }

    // From <dt>/<dd> pairs
    const dtMatches = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
    for (const dm of dtMatches) {
      const label = stripTags(dm[1]).trim();
      const value = stripTags(dm[2]).trim();
      if (label && value) specifications.push(`${label}: ${value}`);
    }

    // Promotional & Transactional — extract installment plans (MintPay, KokoPay, SAMPATH, etc.)
    const paymentParts: string[] = [];

    // Method 1: Look for installment plan blocks — "MintPay Cards", "KokoPay Cards", "SAMPATH Cards"
    // Kapruka shows: "MintPay Cards RS. 177,533 per month 3 months"
    const installmentBlocks = [...html.matchAll(
      /<(?:div|span|p|li|td)[^>]*>\s*((?:mintpay|kokopay|sampath|amex|visa|mastercard|commercial|hsbc|citi|boc|peoples|nations|hnb|seylan|dfcc|nsb)\s*(?:cards?|bank)?)\s*<\/[^>]+>\s*<(?:div|span|p|li|td)[^>]*>\s*(?:rs\.?\s*([\d,]+(?:\.\d+)?)\s*(?:per\s+month|\/\s*month|monthly)?)\s*<\/[^>]+>\s*<(?:div|span|p|li|td)[^>]*>\s*(?:(\d+)\s*months?)?\s*<\/[^>]+>/gi,
    )];
    for (const m of installmentBlocks) {
      const planName = stripTags(m[1]).trim();
      const monthly = m[2] ? Number(m[2].replace(/,/g, '')) : null;
      const months = m[3] ? Number(m[3]) : null;
      const parts: string[] = [planName];
      if (monthly) parts.push(`Rs. ${monthly.toLocaleString('si-LK')}/month`);
      if (months) parts.push(`${months} months`);
      paymentParts.push(parts.join(' · '));
    }

    // Method 2: Broader search for any visible payment offer text
    if (paymentParts.length === 0) {
      const paymentMatch = html.match(/<(?:p|span|div|li|td|strong|b)[^>]*>\s*(?:payment\s+offers?\s+available|installment\s+plan|emi\s+available|card\s+offers?)\s*<\/(?:p|span|div|li|td|strong|b)>/i);
      if (paymentMatch) paymentParts.push(stripTags(paymentMatch[0]).trim());
    }

    // Method 3: "Payment offers available at checkout"
    const checkoutOffers = html.match(/<(?:p|span|div|li)[^>]*>\s*payment\s+offers?\s+available\s+at\s+checkout\s*<\/(?:p|span|div|li)>/i);
    if (checkoutOffers && !paymentParts.some(p => /checkout/i.test(p))) {
      paymentParts.push('Payment offers available at checkout');
    }

    let payment_options = paymentParts.length > 0 ? paymentParts.join(' | ') : '';

    let shipping_info = '';
    // Look for delivery/shipping text in visible elements
    const shippingPatterns = [
      /<(?:p|span|div|li|td|small)[^>]*>\s*(?:low\s+cost\s+islandwide\s+delivery|free\s+delivery|islandwide\s+delivery|delivery\s+available|same\s+day\s+delivery|next\s+day\s+delivery|deliver(?:s|y)?\s+(?:within|in|to)\s+[\d\w\s]+)\s*<\/(?:p|span|div|li|td|small)>/i,
      /<(?:p|span|div|li)[^>]*>\s*(?:delivery|shipping|deliver\s+to|ships?\s+from)\s*[^<]*<\/(?:p|span|div|li)>/i,
    ];
    for (const pat of shippingPatterns) {
      const m = html.match(pat);
      if (m) { shipping_info = stripTags(m[0]).trim().slice(0, 80); break; }
    }

    // Social Proof
    let rating_score: number | null = null;
    let review_count: number | null = null;
    if (ldData?.aggregateRating) {
      const ar = ldData.aggregateRating as Record<string, unknown>;
      rating_score = Number(ar.ratingValue) || null;
      review_count = Number(ar.reviewCount ?? ar.ratingCount) || null;
    }
    if (rating_score === null) {
      const ratingMatch = html.match(/(?:rating|stars?)[:\s]*([\d.]+)\s*(?:\/|out\s+of)\s*5/i);
      if (ratingMatch) rating_score = Number(ratingMatch[1]) || null;
    }
    if (review_count === null) {
      const reviewMatch = html.match(/\((\d+)\s*(?:reviews?|ratings?)\)/i);
      if (reviewMatch) review_count = Number(reviewMatch[1]) || null;
    }

    // Related items — from "related products" / "you may also like" sections
    const related_items: string[] = [];
    const relatedSection = html.match(/(?:related|you\s+may\s+also\s+like|similar|recommended)[^<]*<\/[^>]+>\s*([\s\S]{0,2000})/i);
    if (relatedSection) {
      const relatedNames = [...relatedSection[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map(m => stripTags(m[1]).trim())
        .filter(n => n.length > 3 && n.length < 80 && n !== title);
      related_items.push(...relatedNames.slice(0, 5));
    }

    // Images — ONLY actual product images, filter out UI icons, suggested products, etc.
    const imgUrls: string[] = [];
    
    // og:image (usually the main product image)
    const ogImg = getMeta('og:image');
    if (ogImg && /product|product-image|partnercentral/i.test(ogImg)) imgUrls.push(ogImg);
    
    // JSON-LD images
    if (ldData?.image) {
      const ldImgs = Array.isArray(ldData.image) ? ldData.image : [ldData.image];
      for (const img of ldImgs) {
        if (typeof img === 'string' && img.startsWith('http')) imgUrls.push(img);
      }
    }
    
    // <img> tags — ONLY keep images that look like actual product photos
    // Product image URLs contain: /product-image/, /assets/images/product/, partnercentral product paths
    // EXCLUDE: bar_icons, shops/images, YouTube, logo, banner, icon, button, placeholder, static UI
    const isProductImage = (url: string): boolean => {
      const u = url.toLowerCase();
      // Must contain product-related path
      if (!/product-image|\/product\/|partnercentral.*product|assets\/images\/product/i.test(u)) return false;
      // Must be an actual image extension
      if (!/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(u)) return false;
      // Exclude UI elements
      if (/bar_icons|shops\/images|youtube|logo|banner|icon|button|placeholder|sprite|favicon|social/i.test(u)) return false;
      return true;
    };
    
    for (const m of html.matchAll(/<img[^>]*src=["'](https?:\/\/[^"']+)["']/gi)) {
      const url = m[1];
      if (isProductImage(url)) imgUrls.push(url);
    }
    
    // Also check data-src (lazy-loaded images)
    for (const m of html.matchAll(/<img[^>]*data-src=["'](https?:\/\/[^"']+)["']/gi)) {
      const url = m[1];
      if (isProductImage(url)) imgUrls.push(url);
    }
    
    // Deduplicate — also dedupe by the underlying image filename (different sizes of same image)
    const seenImg = new Set<string>();
    const seenBaseName = new Set<string>();
    const uniqueImgs: string[] = [];
    for (const u of imgUrls) {
      const full = u.startsWith('http') ? u : `https://www.kapruka.com${u}`;
      // Extract base filename to dedupe different sizes (width=700 vs width=64)
      const baseName = full.replace(/.*\//, '').replace(/\?.*$/, '').toLowerCase();
      if (seenImg.has(full)) continue;
      if (seenBaseName.has(baseName)) continue;
      seenImg.add(full);
      seenBaseName.add(baseName);
      uniqueImgs.push(full);
    }

    const mainImage = uniqueImgs[0] || fallbackImage;

    if (!title) return null;

    const result: Record<string, unknown> = {
      // Basic Info
      title,
      price: (currency.toUpperCase() === 'LKR' || currency.toUpperCase() === 'RS' || currency.toUpperCase() === 'RS.') ? (price || fallbackPrice) : fallbackPrice,
      currency: 'LKR',
      availability: /in.?stock/i.test(String(availability)) ? true : (availability || null),
      brand_or_merchant: brand || null,
      warranty_or_guarantee: warranty || null,

      // Key Highlights & Specs
      description,
      specifications: specifications.length > 0 ? specifications.slice(0, 15) : null,

      // Promotional & Transactional
      payment_options: payment_options || null,
      shipping_info: shipping_info || null,

      // Social Proof & Discovery
      rating_score,
      review_count,
      related_items: related_items.length > 0 ? related_items : null,

      // Extras for our UI
      id: safeId,
      name: title,
      in_stock: /in.?stock/i.test(String(availability)),
      stock: String(availability),
      category: fallbackCategory,
      vendor: brand,
      url: pageUrl,
      image: mainImage,
      image_url: mainImage,
      images: uniqueImgs.slice(0, 10),
      summary: description.slice(0, 200),
    };

    console.log(`[product] ${safeId} → page fetch OK: "${title}" | specs=${specifications.length} images=${uniqueImgs.length} rating=${rating_score}`);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      console.log(`[product] ${safeId} → page fetch timed out (5s)`);
    } else {
      console.warn(`[product] ${safeId} → page fetch error:`, err);
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 120, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  let body: { product_id?: string; name?: string; url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { product_id, name: hintName, url: hintUrl } = body;
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

    // ── FALLBACK 1: Structured extraction from raw MCP response ─────────────
    // Zero extra calls — parses whatever we already have (JSON or Markdown)
    // following the detailed schema. Runs before search fallback.
    if (!product && raw && raw.length > 20) {
      console.log(`[product] ${safeId} → trying structured extraction fallback`);
      const structured = extractStructuredProduct(raw, safeId);
      if (structured) {
        product = structured;
        cacheSet(key, product, TTL.PRODUCT);
        console.log(`[product] ${safeId} → structured extraction OK: "${structured.title}" LKR ${structured.price}`);
      }
    }

    // ── FALLBACK 2a: Use provided product URL directly (no search needed) ──────
    // If the caller passed the exact product URL (from search results), fetch it
    // directly. This avoids the unreliable search-by-name + fuzzy match path.
    if (!product && hintUrl && hintUrl.startsWith('http')) {
      console.log(`[product] ${safeId} → fetching provided URL directly: ${hintUrl}`);
      const pageProduct = await fetchKaprukaPage(
        hintUrl, hintName ?? '', 0, '', '', true, safeId,
      );
      if (pageProduct) {
        product = pageProduct;
        cacheSet(key, product, TTL.PRODUCT);
        console.log(`[product] ${safeId} → direct URL fetch OK: "${pageProduct.name}"`);
      }
    }

    // ── FALLBACK 2b: Search by name → fetch product page HTML → extract ──────
    // 1. Search by product name to get the valid Kapruka product URL
    // 2. Fetch that URL and parse the HTML for structured data (schema)
    // 3. If page fetch fails, use search result data directly as last resort
    if (!product && hintName) {
      console.log(`[product] ${safeId} → trying search + page fetch fallback with name: "${hintName}"`);
      try {
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

              // ── Match strategy (in priority order) ──────────────────────────
              let match = results.find(r => String(r.id ?? '') === safeId);
              let matchReason = 'exact ID';

              if (!match) {
                match = results.find(r => String(r.id ?? '').toLowerCase() === safeId.toLowerCase());
                if (match) matchReason = 'case-insensitive ID';
              }

              if (!match && results.length > 0) {
                const tokenize = (s: string): string[] =>
                  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);

                const queryTokens = tokenize(hintName);
                const queryNums = queryTokens.filter(t => /\d/.test(t));

                // Variant differentiators: if the result has one of these but
                // the query does NOT, the result is a different product tier
                // (e.g. query "iPhone 16 128GB" vs result "iPhone 16 Pro Max").
                const variantTokens = ['pro', 'max', 'plus', 'mini', 'ultra', 'promax', 'pro max'];
                const queryHasVariant = variantTokens.some(vt => queryTokens.includes(vt));

                // Storage numbers like 64, 128, 256, 512, 1024 indicate capacity
                // and must match exactly — "128" vs "256" is a different product.
                const storageNums = ['64', '128', '256', '512', '1024'];
                const queryStorage = queryNums.filter(n => storageNums.includes(n));

                let bestScore = -1;
                for (const r of results) {
                  const rName = String(r.name ?? '');
                  const rTokens = tokenize(rName);
                  const rNums = rTokens.filter(t => /\d/.test(t));
                  const rHasVariant = variantTokens.some(vt => rTokens.includes(vt));
                  const rStorage = rNums.filter(n => storageNums.includes(n));

                  let score = 0;
                  for (const qt of queryTokens) {
                    if (rTokens.includes(qt)) score += 2;
                    else if (rTokens.some(rt => rt.includes(qt) || qt.includes(rt))) score += 1;
                  }

                  for (const qn of queryNums) {
                    if (rNums.includes(qn)) score += 5;
                    else if (rNums.length > 0) score -= 3;
                  }

                  // ── Variant penalty ──────────────────────────────────────
                  // If the result has "Pro"/"Max" etc. but the query doesn't
                  // (or vice versa), heavily penalize — they're different tiers.
                  if (queryHasVariant !== rHasVariant) {
                    score -= 10;
                  }

                  // ── Storage mismatch penalty ─────────────────────────────
                  // If both have a storage number but they don't match exactly,
                  // it's a different capacity variant — penalize heavily.
                  if (queryStorage.length > 0 && rStorage.length > 0) {
                    const storageMatch = queryStorage.some(qs => rStorage.includes(qs));
                    if (!storageMatch) {
                      score -= 10;
                    } else {
                      score += 5; // bonus for exact storage match
                    }
                  }

                  const overlap = queryTokens.filter(qt => rTokens.includes(qt)).length;
                  score += overlap / Math.max(queryTokens.length, rTokens.length) * 3;

                  if (score > bestScore) {
                    bestScore = score;
                    match = r;
                    matchReason = `fuzzy name (score=${score.toFixed(1)})`;
                  }
                }

                if (match) {
                  console.log(`[product] ${safeId} → matched by ${matchReason}: "${match.name}"`);
                }
              }

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

                // ── Determine if the fuzzy match is trustworthy enough to
                //    fetch the product page. If the match has variant or
                //    storage mismatches, fetching the page would give us the
                //    WRONG product's rich data (images, specs, description).
                //    In that case, skip FALLBACK 2a and use search data (2b).
                const isExactIdMatch = matchReason === 'exact ID' || matchReason === 'case-insensitive ID';
                let skipPageFetch = !isExactIdMatch;

                if (!isExactIdMatch && hintName) {
                  // Re-check variant/storage alignment between the query and
                  // the matched product name to decide if page fetch is safe.
                  const tokenize = (s: string): string[] =>
                    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
                  const qTokens = tokenize(hintName);
                  const mTokens = tokenize(mName);
                  const variantTokens = ['pro', 'max', 'plus', 'mini', 'ultra', 'promax'];
                  const storageNums = ['64', '128', '256', '512', '1024'];
                  const qHasVariant = variantTokens.some(vt => qTokens.includes(vt));
                  const mHasVariant = variantTokens.some(vt => mTokens.includes(vt));
                  const qStorage = qTokens.filter(t => storageNums.includes(t));
                  const mStorage = mTokens.filter(t => storageNums.includes(t));
                  const variantOk = qHasVariant === mHasVariant;
                  const storageOk = qStorage.length === 0 || mStorage.length === 0 ||
                                    qStorage.some(qs => mStorage.includes(qs));
                  if (variantOk && storageOk) {
                    skipPageFetch = false;
                  }
                }

                // ── FALLBACK 2a: Fetch the actual Kapruka product page ──────────
                // Use the valid product URL from search results to fetch the
                // real page HTML and extract structured data per the schema.
                // NEVER retry get_product — only fetch the page URL.
                // SKIPPED when the fuzzy match is unreliable (wrong variant/storage).
                if (productUrl && productUrl.startsWith('http') && !skipPageFetch) {
                  console.log(`[product] ${safeId} → fetching page: ${productUrl}`);
                  const pageProduct = await fetchKaprukaPage(
                    productUrl, mName, mPrice, imageUrl, mCategory, mInStock, safeId,
                  );
                  if (pageProduct) {
                    product = pageProduct;
                    cacheSet(key, product, TTL.PRODUCT);
                    console.log(`[product] ${safeId} → page fetch fallback OK: "${pageProduct.name}"`);
                  }
                } else if (skipPageFetch) {
                  console.log(`[product] ${safeId} → skipping page fetch (unreliable fuzzy match for "${mName}")`);
                }

                // ── FALLBACK 2b: Use search result data directly (last resort) ──
                if (!product) {
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
                  console.log(`[product] ${safeId} → search data fallback OK: "${mName}" LKR ${mPrice}`);
                }
              } else {
                console.log(`[product] ${safeId} → search fallback: no results returned`);
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
