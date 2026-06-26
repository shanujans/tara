import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeProduct } from '@/lib/security';
import { cacheGet, cacheSet, cacheKey, TTL } from '@/lib/cache';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

// ── Product shape matching sanitizeProduct output ──────────────────────
interface Product {
  id:          string;
  name:        string;
  price:       number;
  image:       string;
  url:         string;
  summary:     string;
  category:    string;
  in_stock:    boolean;
  stock_level: string;
}

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG LOGGER — prefix every line so you can grep "TARA:SEARCH" in Vercel logs
// ─────────────────────────────────────────────────────────────────────────────
const LOG = {
  info:  (msg: string, data?: unknown) => console.log (`[TARA:SEARCH] ℹ️  ${msg}`, data !== undefined ? data : ''),
  warn:  (msg: string, data?: unknown) => console.warn(`[TARA:SEARCH] ⚠️  ${msg}`, data !== undefined ? data : ''),
  error: (msg: string, data?: unknown) => console.error(`[TARA:SEARCH] ❌ ${msg}`, data !== undefined ? data : ''),

  parse: (raw: string, parsed: SearchParams) => {
    console.log(
      `[TARA:SEARCH] 📋 PARSED SEARCH PARAMS:\n` +
      `   q            : "${parsed.q}"\n` +
      `   category     : ${parsed.category  ?? '(none)'}\n` +
      `   min_price    : ${parsed.min_price  ?? '(none)'}\n` +
      `   max_price    : ${parsed.max_price  ?? '(none)'}\n` +
      `   in_stock_only: ${parsed.in_stock_only}\n` +
      `   sort         : ${parsed.sort       ?? '(none)'}\n` +
      `   raw input    : "${raw.slice(0, 120)}"`
    );
  },

  mcp: (tier: string, args: Record<string, unknown>) => {
    console.log(
      `[TARA:SEARCH] 🌐 MCP CALL (${tier}):\n` +
      JSON.stringify(args, null, 2)
    );
  },

  mcpResult: (tier: string, count: number, elapsedMs: number, cacheHit = false) => {
    const src = cacheHit ? '📦 CACHE' : '🌐 MCP  ';
    console.log(
      `[TARA:SEARCH] ${src} ${tier}: ${count} products in ${elapsedMs}ms`
    );
  },

  fallback: (tier: string, reason: string, currentCount: number) => {
    console.log(
      `[TARA:SEARCH] ♻️  FALLBACK → ${tier}\n` +
      `   reason       : ${reason}\n` +
      `   current count: ${currentCount}`
    );
  },

  categoryFilter: (before: number, after: number, category: string) => {
    console.log(
      `[TARA:SEARCH] 🔍 POST-MERGE CATEGORY FILTER: "${category}"\n` +
      `   before: ${before} | after: ${after} | removed: ${before - after}`
    );
  },

  validate: (before: number, after: number, query: string) => {
    console.log(
      `[TARA:SEARCH] 🛡️  AI VALIDATE: "${query}"\n` +
      `   before: ${before} | after: ${after} | removed: ${before - after}`
    );
  },

  diversify: (buckets: Record<string, number>, finalCount: number) => {
    const summary = Object.entries(buckets)
      .map(([cat, n]) => `    "${cat}": ${n}`)
      .join('\n');
    console.log(
      `[TARA:SEARCH] 🗂️  CATEGORY BUCKETS:\n${summary}\n` +
      `   → final diversified count: ${finalCount}`
    );
  },

  final: (count: number, quantum: boolean, elapsedMs: number) => {
    console.log(
      `[TARA:SEARCH] ✅ RESPONSE: ${count} products | quantum=${quantum} | total=${elapsedMs}ms`
    );
  },
};

/** URLs that belong to gated portals — never usable as public images */
const GATED  = /partnercentral\.|partner\.|admin\.|cms\./i;
const IS_IMG = (u: string) =>
  /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u) ||
  /productImages|\/images\/|\/photos\//i.test(u);

/**
 * Fallback parser for Markdown-formatted search results (kept for safety)
 */
function parseMarkdownSearch(md: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  const blocks = md.split(/(?=\*\*\d+\.\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/^\*\*\d+\.\s+(.+?)\*\*/);
    if (!nameMatch) continue;

    const name    = nameMatch[1].replace(/`/g, '').trim();
    const rawUrls = new Set<string>();

    for (const m of block.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)) rawUrls.add(m[1].trim());
    for (const m of block.matchAll(/https?:\/\/[^\s)"'\]\\<>]+/g))      rawUrls.add(m[0].replace(/[.,;:!?)\]]+$/, ''));

    const allUrls   = [...rawUrls];
    const imgUrl    = allUrls.find(u => IS_IMG(u) && !GATED.test(u)) ?? allUrls.find(u => IS_IMG(u)) ?? '';
    const productUrl = allUrls.find(u => !GATED.test(u) && !IS_IMG(u) && u.includes('kapruka.com')) ?? '';

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

  LOG.warn(`parseMarkdownSearch fallback used — ${products.length} items extracted`);
  return products;
}

interface SearchParams {
  q:             string;
  category?:     string;
  min_price?:    number;
  max_price?:    number;
  in_stock_only?: boolean;
  sort?:         string;
}

interface KaprukaRawItem {
  id?:        string;
  name?:      string;
  price?:     { amount?: number; currency?: string };
  url?:       string;
  image_url?: string;
  category?:  { id?: string; name?: string; slug?: string };
  in_stock?:  boolean;
}

async function mcpSearch(
  p:      SearchParams,
  sid:    string,
  limit = 50,
  label = 'PRIMARY',                 // ← label for debug output
): Promise<Record<string, unknown>[]> {

  const key = cacheKey('search', p.q, p.category, p.min_price, p.max_price, p.in_stock_only, limit);
  const t0  = Date.now();

  const hit = cacheGet<Record<string, unknown>[]>(key);
  if (hit) {
    LOG.mcpResult(label, hit.length, Date.now() - t0, true);
    return hit;
  }

  // ── Build MCP args ────────────────────────────────────────────────────────
  const args: Record<string, unknown> = {
    q:               p.q.slice(0, 100),
    limit,
    cursor:          null,
    currency:        'LKR',
    sort:            p.sort ?? 'relevance',   // ✅ FIX: use caller-provided sort, not hardcoded
    include_stubs:   false,
    response_format: 'json',
    category:        p.category     ?? null,
    min_price:       p.min_price    ?? null,
    max_price:       p.max_price    ?? null,
    in_stock_only:   p.in_stock_only !== false,
  };

  LOG.mcp(label, args);

  const r = await fetch(MCP, {
    method:  'POST',
    headers: { ...H, 'mcp-session-id': sid },
    body:    JSON.stringify({
      jsonrpc: '2.0',
      id:      String(Date.now()),
      method:  'tools/call',
      params:  { name: 'kapruka_search_products', arguments: { params: args } },
    }),
  });

  if (!r.ok) {
    LOG.error(`MCP HTTP error: ${r.status} ${r.statusText}`);
    return [];
  }

  const text = await r.text();
  const m    = text.match(/^data:\s*(.+)$/m);
  const json = m ? m[1] : text;

  try {
    const data = JSON.parse(json) as { result?: { content?: { text?: string }[] } };
    const raw  = data?.result?.content?.[0]?.text ?? '';

    // Log raw MCP response snippet for debugging
    LOG.info(`MCP raw response (first 300 chars): ${raw.slice(0, 300).replace(/\n/g, ' ')}`);

    try {
      const parsed     = JSON.parse(raw);
      const rawResults = parsed.results || parsed.products || parsed.items || [];

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        const mappedResults = rawResults.map((item: KaprukaRawItem) => ({
          id:        item.id        || `mk_${Date.now()}_${Math.random()}`,
          name:      item.name      || '',
          price:     item.price?.amount || 0,
          url:       item.url       || '',
          image_url: item.image_url || '',
          category:  item.category?.name || '',
          in_stock:  item.in_stock  ?? true,
        }));

        LOG.mcpResult(label, mappedResults.length, Date.now() - t0);
        cacheSet(key, mappedResults, TTL.SEARCH);
        return mappedResults;
      }

      LOG.warn(`MCP JSON parsed but results array is empty (label=${label})`);
    } catch {
      // Fallback to markdown parser
      LOG.warn(`MCP response not valid JSON — trying markdown parser (label=${label})`);
      const result = parseMarkdownSearch(raw);
      if (result.length) {
        cacheSet(key, result, TTL.SEARCH);
        LOG.mcpResult(label, result.length, Date.now() - t0);
        return result;
      }
    }
  } catch (e) {
    LOG.error(`Failed to parse MCP outer JSON (label=${label})`, e);
  }

  LOG.mcpResult(label, 0, Date.now() - t0);
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-SEARCH AI VALIDATOR
// Filters out "dumb matches" (MAC makeup for Apple Mac searches).
// Extended with stronger tech / category heuristics.
// ─────────────────────────────────────────────────────────────────────────────
async function aiValidateProducts(
  query:    string,
  products: Product[],
): Promise<Product[]> {

  const q = query.toLowerCase();

  // ── Intent flags ──────────────────────────────────────────────────────────
  const isTechSearch    = /macbook|mac mini|imac|laptop|computer|ipad|tablet|monitor|ssd|ram|router|wifi|keyboard|mouse/i.test(q);
  const isAppleSearch   = /\bmac\b|macbook|imac|mac mini|ipad|iphone|airpods|apple/i.test(q);
  const isPhoneSearch   = /iphone|samsung|galaxy|pixel|smartphone|redmi|xiaomi|oppo/i.test(q);
  const isCosmeticQuery = /lipstick|foundation|mascara|blush|concealer|eyeliner|makeup|beauty|cosmetic/i.test(q);
  const isFoodSearch    = /\bapple\b.*\b(fruit|kg|fresh|eat)\b|\b(fresh|fruit|kg|eat).*\bapple\b/i.test(q);

  LOG.info(
    `aiValidateProducts flags — tech=${isTechSearch} apple=${isAppleSearch} ` +
    `phone=${isPhoneSearch} cosmetic=${isCosmeticQuery} food=${isFoodSearch} | q="${q}"`
  );

  const before = products.length;

  const filtered = products.filter(p => {
    const name = (p.name     ?? '').toLowerCase();
    const cat  = (p.category ?? '').toLowerCase();

    // ── Tech search guards ────────────────────────────────────────────────
    if (isTechSearch && !isCosmeticQuery) {
      if (/beauty|cosmetic|skincare|makeup|fashion|clothing|grocery|food|beverage|stationery/i.test(cat)) {
        LOG.info(`  ✂️  Removed (tech+wrong-cat): "${p.name}" [${p.category}]`);
        return false;
      }
      if (/lipstick|foundation|powder|serum|shampoo|soap|cream|lotion|perfume|mascara|blush/i.test(name)) {
        LOG.info(`  ✂️  Removed (tech+wrong-name): "${p.name}"`);
        return false;
      }
    }

    // ── Apple/MAC disambiguation ──────────────────────────────────────────
    if (isAppleSearch && !isCosmeticQuery && !isFoodSearch) {
      // "MAC Studio Fix", "MAC Lipstick", "M.A.C. Foundation" etc.
      if (/\bmac\b/i.test(name) && /cosmetic|beauty|lip|eye|studio|fix|powder|blush|brush/i.test(name + ' ' + cat)) {
        LOG.info(`  ✂️  Removed (MAC cosmetic false positive): "${p.name}" [${p.category}]`);
        return false;
      }
      // Apple fruit false positive on Apple tech searches
      if (/\bapple\b/i.test(name) && /fruit|vegetable|fresh|produce/i.test(cat)) {
        LOG.info(`  ✂️  Removed (Apple fruit on tech search): "${p.name}" [${p.category}]`);
        return false;
      }
    }

    // ── Phone search — exclude accessories that sneak in at high prices ───
    if (isPhoneSearch) {
      if (/\b(cover|case|screen.?guard|tempered.?glass|cable|charger|adapter|holder|stand)\b/i.test(name) && p.price > 20000) {
        LOG.info(`  ✂️  Removed (expensive accessory on phone search): "${p.name}" LKR ${p.price}`);
        return false;
      }
    }

    return true;
  });

  LOG.validate(before, filtered.length, q);

  // Optional LLM guard (uncomment when ready)
  /*
  try {
    const prompt = `User wants: "${query}". Keep only products relevant to that intent.
Return JSON: { "ids": ["id1", "id2"] }.
Products: ${JSON.stringify(filtered.map(p => ({ id: p.id, name: p.name, category: p.category })))}`;
    ...
  } catch (e) {
    LOG.warn('LLM guard failed, using heuristic filter', e);
  }
  */

  return filtered;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const routeStart = Date.now();
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  if (!rateLimit(ip, 30, 60_000)) {
    LOG.warn(`Rate limit hit for IP: ${ip}`);
    return NextResponse.json({ products: [] }, { status: 429 });
  }

  let body: { primary?: string };
  try {
    body = await req.json();
  } catch {
    LOG.warn('Failed to parse request JSON');
    return NextResponse.json({ products: [] });
  }

  const { primary } = body;
  if (!primary || primary.length < 2) {
    LOG.warn(`primary too short or missing: "${primary}"`);
    return NextResponse.json({ products: [] });
  }

  // ── Parse search params ───────────────────────────────────────────────────
  let sp: SearchParams;
  const trimmed = primary.trim();

  if (trimmed.startsWith('{')) {
    // ── JSON path (from TARA's <search_query> tag) ──────────────────────────
    try {
      const parsed = JSON.parse(trimmed) as Partial<SearchParams>;

      sp = {
        q:             (parsed.q ?? primary).slice(0, 80),
        category:      parsed.category     || undefined,
        min_price:     parsed.min_price    || undefined,
        max_price:     parsed.max_price    || undefined,
        in_stock_only: parsed.in_stock_only !== false,
        sort:          parsed.sort         || 'relevance',   // ✅ FIX: preserve AI-chosen sort
      };

      LOG.info('Input mode: JSON (from TARA search_query tag)');
    } catch {
      LOG.warn('Failed to parse JSON primary — falling back to plain query');
      sp = { q: primary, in_stock_only: true, sort: 'relevance' };
    }

  } else {
    // ── Natural language path (direct UI query) ─────────────────────────────
    LOG.info('Input mode: natural language');
    let cleanQ     = trimmed;
    let max_price: number | undefined;
    let min_price: number | undefined;

    const maxMatch = cleanQ.match(/(?:under|below|less\s+than|max|<=|<)\s*(?:lkr|rs\.?)?\s*(\d+)\s*(k)?/i);
    if (maxMatch) {
      let val = parseInt(maxMatch[1], 10);
      if (maxMatch[2]?.toLowerCase() === 'k') val *= 1000;
      max_price = val;
      cleanQ    = cleanQ.replace(maxMatch[0], '');
      LOG.info(`NL price extraction → max_price: ${max_price}`);
    }

    const minMatch = cleanQ.match(/(?:above|over|greater\s+than|min|>=|>)\s*(?:lkr|rs\.?)?\s*(\d+)\s*(k)?/i);
    if (minMatch) {
      let val = parseInt(minMatch[1], 10);
      if (minMatch[2]?.toLowerCase() === 'k') val *= 1000;
      min_price = val;
      cleanQ    = cleanQ.replace(minMatch[0], '');
      LOG.info(`NL price extraction → min_price: ${min_price}`);
    }

    const pipeMaxMatch = trimmed.match(/max_price:(\d+)/)?.[1];
    if (pipeMaxMatch) {
      max_price = Number(pipeMaxMatch);
      LOG.info(`Pipe max_price extracted: ${max_price}`);
    }

    cleanQ = cleanQ
      .replace(/\|.*/g, '')
      .replace(/\b(under|below|above|over|less\s+than|greater\s+than|lkr|rs\.?)\b/ig, '')
      .replace(/\s+/g, ' ')
      .trim();

    sp = { q: cleanQ || trimmed, max_price, min_price, in_stock_only: true, sort: 'relevance' };
  }

  LOG.parse(trimmed, sp);

  // ── Execute search with 3-tier fallback ───────────────────────────────────
  try {
    const sid = await mcpSession();

    // ── TIER 1: Full params as-is ─────────────────────────────────────────
    const r1 = await mcpSearch(sp, sid, 50, 'TIER-1 (full params)');

    // ── TIER 2: Keep category, relax price + stock ────────────────────────
    // ✅ FIX: category is preserved so "Computers And Accessories" stays locked
    let r2: Record<string, unknown>[] = [];
    if (r1.length < 5) {
      LOG.fallback(
        'TIER-2 (category kept, price/stock relaxed)',
        `only ${r1.length} results from TIER-1`,
        r1.length,
      );
      r2 = await mcpSearch(
        {
          q:             sp.q,
          category:      sp.category,   // ← KEEP category filter
          in_stock_only: false,          // ← relax stock
          sort:          'relevance',
          // min_price / max_price intentionally dropped for broader results
        },
        sid,
        50,
        'TIER-2 (category+no-price)',
      );
    }

    // ── TIER 3: Drop category, broaden keyword ────────────────────────────
    let r3: Record<string, unknown>[] = [];
    if (r1.length + r2.length < 5) {
      const words   = sp.q.split(' ').filter(w => w.length > 2);
      const broader = words[0] ?? sp.q;

      LOG.fallback(
        'TIER-3 (category dropped, broader keyword)',
        `only ${r1.length + r2.length} results after TIER-2`,
        r1.length + r2.length,
      );

      r3 = await mcpSearch(
        {
          q:             broader,
          in_stock_only: false,
          sort:          'relevance',
          // no category, no price — last resort
        },
        sid,
        50,
        `TIER-3 (q="${broader}", no-category)`,
      );
    }

    // ── Merge & deduplicate ───────────────────────────────────────────────
    const seen = new Set<string>();
    let mergedProducts: Product[] = [...r1, ...r2, ...r3]
      .map(p => sanitizeProduct(p) as Product)
      .filter(p => {
        if (!p.id || !p.name || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

    LOG.info(`After merge+dedup: ${mergedProducts.length} products (r1=${r1.length}, r2=${r2.length}, r3=${r3.length})`);

    // ── ✅ FIX: Post-merge category re-filter ─────────────────────────────
    // Ensures Tier-3 items don't poison results with unrelated categories
    if (sp.category && mergedProducts.length > 0) {
      const needle       = sp.category.toLowerCase();
      const beforeFilter = mergedProducts.length;

      const categoryFiltered = mergedProducts.filter(p => {
        const hay = (p.category ?? '').toLowerCase();
        // Allow: exact match, substring match, or products with no category set
        return hay.includes(needle) || needle.includes(hay) || hay === '';
      });

      LOG.categoryFilter(beforeFilter, categoryFiltered.length, sp.category);

      // Only apply filter if it doesn't wipe everything (safety net)
      if (categoryFiltered.length > 0) {
        mergedProducts = categoryFiltered;
      } else {
        LOG.warn(
          `Category filter "${sp.category}" removed ALL products — ` +
          `keeping unfiltered results. Check category name vs MCP.`,
        );
        // Log all unique categories we received to help debug mismatches
        const receivedCats = [...new Set(mergedProducts.map(p => p.category).filter(Boolean))];
        LOG.warn('Categories received from MCP:', receivedCats);
      }
    }

    // ── Stratified category diversification (only when no specific category) ─
    if (!sp.category && mergedProducts.length > 0) {
      const buckets: Record<string, Product[]> = {};
      for (const item of mergedProducts) {
        const cat = item.category || 'Other';
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(item);
      }

      const sortedCats        = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length);
      const diverseResult:     Product[] = [];
      const distributionLimits           = [20, 15, 10, 5];

      for (let i = 0; i < sortedCats.length; i++) {
        const cat   = sortedCats[i];
        const limit = distributionLimits[i] ?? 2;
        diverseResult.push(...buckets[cat].splice(0, limit));
      }
      // Fill remaining slots
      for (const cat of sortedCats) {
        if (diverseResult.length >= 50) break;
        const needed = 50 - diverseResult.length;
        diverseResult.push(...buckets[cat].splice(0, needed));
      }

      const bucketSummary = Object.fromEntries(
        sortedCats.map(c => [c, (buckets[c].length || 0) + (diverseResult.filter(p => p.category === c).length)])
      );
      LOG.diversify(bucketSummary, diverseResult.length);
      mergedProducts = diverseResult;
    }

    // ── AI heuristic validation ───────────────────────────────────────────
    mergedProducts = await aiValidateProducts(sp.q, mergedProducts);

    // ── Final clip ────────────────────────────────────────────────────────
    const products = mergedProducts.slice(0, 50);
    const quantum  = products.length > 0;

    LOG.final(products.length, quantum, Date.now() - routeStart);

    // Debug: log first 3 product names so you can quickly eyeball in terminal
    if (products.length > 0) {
      const preview = products.slice(0, 3).map((p, i) => `  [${i + 1}] "${p.name}" (${p.category}) LKR ${p.price}`).join('\n');
      LOG.info(`Top 3 results:\n${preview}`);
    }

    return NextResponse.json({ products, quantum });

  } catch (e) {
    LOG.error('Unhandled search error', e);
    return NextResponse.json({ products: [], quantum: false });
  }
}