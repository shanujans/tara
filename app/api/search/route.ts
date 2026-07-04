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
  _retrying = false,                 // ← internal: true after one retry with a fresh session
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

    // BUG FIX: Kapruka's MCP occasionally returns a plain-text upstream error (e.g. rate
    // limiting) instead of JSON or Markdown. This used to fall straight into the markdown
    // parser, extract 0 items, and get silently treated as "genuinely zero results" —
    // relying entirely on the TIER-2/TIER-3 fallback to save the request. Detect it
    // explicitly and retry once with a fresh session + short backoff first.
    const UPSTREAM_ERROR_RE = /rate limit|too many requests|internal server error|service unavailable|please try again|temporarily unavailable|invalid session|session.*expired/i;
    if (!_retrying && UPSTREAM_ERROR_RE.test(raw)) {
      LOG.warn(`Upstream error detected (label=${label}) — retrying once with a fresh session`, raw.slice(0, 120));
      await new Promise(res => setTimeout(res, 400));
      const freshSid = await mcpSession(true);
      return mcpSearch(p, freshSid, limit, label, true);
    }

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
  // ── Intent flags ──────────────────────────────────────────────────────────
  const isTechSearch    = /macbook|mac mini|imac|laptop|computer|ipad|tablet|monitor|ssd|ram|router|wifi|keyboard|mouse/i.test(q);
  const isAppleSearch   = /\bmac\b|macbook|imac|mac mini|ipad|iphone|airpods|\bapple\b/i.test(q);
  const isPhoneSearch   = /iphone|samsung|galaxy|pixel|smartphone|redmi|xiaomi|oppo|oneplus|nokia/i.test(q);
  const isCosmeticQuery = /lipstick|foundation|mascara|blush|concealer|eyeliner|makeup|beauty|cosmetic/i.test(q);
  const isFoodSearch    = /\bapple\b/i.test(q) && /fruit|kg|fresh|eat|red|green|basket/i.test(q);
  // Automobile guard — "oil" / "lubricant" should NEVER match liquor, food, beauty
  const isAutoSearch    = /engine.?oil|lubricant|gear.?oil|grease|coolant|brake.?fluid|transmission/i.test(q);

  LOG.info(
    `aiValidateProducts flags — tech=${isTechSearch} apple=${isAppleSearch} ` +
    `phone=${isPhoneSearch} cosmetic=${isCosmeticQuery} food=${isFoodSearch} auto=${isAutoSearch} | q="${q}"`
  );

  const before = products.length;

  const filtered = products.filter(p => {
    const name = (p.name     ?? '').toLowerCase();
    const cat  = (p.category ?? '').toLowerCase();

    // ── Automobile / oil search guard ─────────────────────────────────────
    // This catches the "engine oil → Jack Daniels" bug where the fallback
    // broadens "engine oil" to "oil" and returns liquor / cooking oil.
    if (isAutoSearch) {
      if (/liquor|whisky|whiskey|brandy|arrack|beer|wine|spirits/i.test(cat + ' ' + name)) {
        LOG.info(`  ✂️  Removed (auto search → liquor false positive): "${p.name}" [${p.category}]`);
        return false;
      }
      if (/coconut.?oil|cooking.?oil|hair.?oil|baby.?oil|essential.?oil|olive.?oil/i.test(name)) {
        LOG.info(`  ✂️  Removed (auto search → food/beauty oil false positive): "${p.name}"`);
        return false;
      }
    }

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
      if (/\bmac\b/i.test(name) && /cosmetic|beauty|lip|eye|studio|fix|powder|blush|brush/i.test(name + ' ' + cat)) {
        LOG.info(`  ✂️  Removed (MAC cosmetic false positive): "${p.name}" [${p.category}]`);
        return false;
      }
      if (/\bapple\b/i.test(name) && /fruit|vegetable|fresh|grocery/i.test(cat)) {
        LOG.info(`  ✂️  Removed (Apple fruit on tech search): "${p.name}" [${p.category}]`);
        return false;
      }
    }

    // ── Phone search — block accessories slipping in at phone-level prices ─
    if (isPhoneSearch) {
      if (/\b(cover|case|screen.?guard|tempered.?glass|cable|charger|adapter|holder|stand)\b/i.test(name) && p.price > 25000) {
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
// Loopback IPs are never real client IPs in production —
// exempt them so local dev doesn't burn the rate-limit bucket.
const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost']);

export async function POST(req: NextRequest) {
  const routeStart = Date.now();
  const ip = req.headers.get('x-real-ip')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
          ?? 'unknown';

  if (!LOOPBACK.has(ip) && !rateLimit(`search:${ip}`, 30, 60_000)) {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH STRATEGY: 3-tier with Category Discovery
  //
  // The AI in chat/route.ts picks a category name as a hint, but Kapruka's MCP
  // may use different internal category strings. Instead of hardcoding a mapping,
  // we let the MCP tell us the right category:
  //
  // TIER-1: Try with full params (AI-specified category + price + stock)
  // TIER-2: DISCOVERY — search without category, bucket results by their REAL
  //         MCP category, find the dominant category, re-search with its exact
  //         name. This self-corrects any AI category name mismatch automatically.
  // TIER-3: Broader keyword (first word only) if TIER-1 + TIER-2 both low.
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const sid = await mcpSession();

    // ── TIER 1: Full params as-is ─────────────────────────────────────────
    const r1 = await mcpSearch(sp, sid, 50, 'TIER-1 (full params)');

    // ── TIER 2: Category Discovery ────────────────────────────────────────
    // Fires when TIER-1 returns < 5 results — usually means the category string
    // the AI chose doesn't match what Kapruka's MCP stores internally.
    // e.g. AI sends "Engine Oils And Lubricants" but MCP stores "Automobile".
    //
    // Strategy:
    //   1. Search WITHOUT any category filter → get products from all categories
    //   2. Bucket those products by their ACTUAL MCP category field
    //   3. Find the dominant category (most products for this keyword)
    //   4. Re-search WITH that real category name for a clean, precise set
    //   5. Fall back to raw discovery results if targeted re-search underperforms
    let discoveredCategory: string | undefined;
    let r2: Record<string, unknown>[] = [];

    if (r1.length < 5) {
      LOG.fallback(
        'TIER-2 DISCOVERY (category:null)',
        `only ${r1.length} results from TIER-1 with category="${sp.category ?? 'null'}"`,
        r1.length,
      );

      const discoveryRaw = await mcpSearch(
        { q: sp.q, in_stock_only: false, sort: 'relevance' },
        sid,
        50,
        'TIER-2 DISCOVERY',
      );

      if (discoveryRaw.length > 0) {
        // ── Bucket by the category field that MCP actually returned ─────────
        const catBuckets: Record<string, Array<Record<string, unknown>>> = {};
        for (const item of discoveryRaw) {
          const p   = sanitizeProduct(item) as Product;
          const cat = p.category || 'Unknown';
          if (!catBuckets[cat]) catBuckets[cat] = [];
          catBuckets[cat].push(item);
        }

        // Sort categories by product count (most → least)
        const sortedDiscovered = Object.entries(catBuckets)
          .sort((a, b) => b[1].length - a[1].length);

        // Log the full breakdown — this is the key diagnostic output
        // e.g. [TARA:SEARCH] DISCOVERY breakdown: { "Automobile": 18, "Grocery": 3, ... }
        const breakdown = Object.fromEntries(
          sortedDiscovered.map(([cat, items]) => [cat, items.length])
        );
        LOG.info(`DISCOVERY category breakdown for q="${sp.q}":`, breakdown);

        discoveredCategory        = sortedDiscovered[0]?.[0];
        const discoveredCount     = sortedDiscovered[0]?.[1].length ?? 0;
        LOG.info(`Dominant category: "${discoveredCategory}" (${discoveredCount} products)`);

        const aiCatLower   = (sp.category ?? '').toLowerCase();
        const realCatLower = (discoveredCategory ?? '').toLowerCase();

        // ── "General" guard ────────────────────────────────────────────────
        // Kapruka's MCP returns category:"General" for ALL products — it is NOT
        // a real filter category. Re-searching with category:"General" returns
        // completely unrelated products (cakes, statues, etc.).
        // When dominant = "General", just use the discovery results as-is.
        const isGeneral = realCatLower === 'general' || realCatLower === '';

        if (isGeneral) {
          LOG.info(
            `TIER-2: dominant category is "${discoveredCategory}" (not a real filter) — ` +
            `using discovery results directly (${discoveryRaw.length} products)`,
          );
          r2 = discoveryRaw;
          discoveredCategory = undefined; // treat as unfiltered so diversification runs
        } else if (discoveredCategory && realCatLower !== aiCatLower) {
          // Category mismatch — re-search with the REAL name from MCP
          LOG.warn(
            `Category mismatch: AI sent "${sp.category}" → ` +
            `MCP dominant is "${discoveredCategory}" — re-searching with real name`,
          );

          const r2Targeted = await mcpSearch(
            {
              q:             sp.q,
              category:      discoveredCategory,
              min_price:     sp.min_price,
              max_price:     sp.max_price,
              in_stock_only: false,
              sort:          sp.sort,
            },
            sid,
            50,
            `TIER-2 TARGETED ("${discoveredCategory}")`,
          );

          // Use targeted if it's comparable to discovery; else fall back to raw
          r2 = r2Targeted.length >= Math.floor(discoveredCount * 0.5)
            ? r2Targeted
            : discoveryRaw;

          LOG.info(
            `TIER-2 result: targeted=${r2Targeted.length}, discovery=${discoveryRaw.length} → using ${r2 === r2Targeted ? 'targeted' : 'discovery'}`,
          );
        } else {
          // Category matched or no category — use discovery directly
          r2 = discoveryRaw;
          LOG.info(`TIER-2: category matched — using discovery results directly (${r2.length})`);
        }
      } else {
        LOG.warn(`TIER-2 DISCOVERY also returned 0 results for q="${sp.q}"`);
      }
    }

    // ── TIER 3: Broader keyword ───────────────────────────────────────────
    // Only fires if TIER-1 + TIER-2 are both still very thin.
    // No SKIP_TIER3 blocklist needed: TIER-2 discovery already validated whether
    // MCP has products for this keyword — if it doesn't, broadening may help.
    let r3: Record<string, unknown>[] = [];
    if (r1.length + r2.length < 5) {
      const words   = sp.q.split(' ').filter(w => w.length > 2);
      const broader = words[0] ?? sp.q;

      if (broader !== sp.q) {
        LOG.fallback(
          `TIER-3 BROADER (q="${broader}", category:null)`,
          `only ${r1.length + r2.length} after TIER-2`,
          r1.length + r2.length,
        );
        r3 = await mcpSearch(
          { q: broader, in_stock_only: false, sort: 'relevance' },
          sid,
          50,
          `TIER-3 BROADER ("${broader}")`,
        );
      } else {
        LOG.info(`TIER-3 skipped — broader keyword same as original ("${sp.q}")`);
      }
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

    LOG.info(
      `After merge+dedup: ${mergedProducts.length} products ` +
      `(r1=${r1.length}, r2=${r2.length}, r3=${r3.length})`
    );

    // ── Category filter using the REAL (discovered) category name ─────────
    // Priority: discoveredCategory (from MCP actual response) > sp.category (AI hint)
    // SKIP if filterCategory is "General" — MCP assigns "General" to every product,
    // so filtering by it removes everything and re-searching with it returns junk.
    const filterCategory = discoveredCategory ?? sp.category;
    const skipFilter = !filterCategory
      || filterCategory.toLowerCase() === 'general'
      || filterCategory === '';

    if (!skipFilter && mergedProducts.length > 0) {
      const needle       = filterCategory!.toLowerCase();
      const beforeFilter = mergedProducts.length;

      // Kapruka MCP returns category.name = "General" for ALL products regardless
      // of their actual category. This is an MCP API quirk — the real category is
      // embedded in the product summary string (e.g. "Electronics, Mobilephones").
      // Rules for the filter:
      //   1. "General" category products always pass through (they are real products)
      //   2. Empty category string passes through
      //   3. Actual category match (hay contains needle or vice versa) passes through
      const categoryFiltered = mergedProducts.filter(p => {
        const hay = (p.category ?? '').toLowerCase().trim();
        // Pass: no category set or MCP's generic "General" placeholder
        if (hay === '' || hay === 'general') return true;
        // Pass: real category match (bidirectional substring)
        return hay.includes(needle) || needle.includes(hay);
      });

      LOG.categoryFilter(beforeFilter, categoryFiltered.length, filterCategory!);

      // Log a sample of what the filter kept vs dropped for diagnosis
      if (categoryFiltered.length < beforeFilter) {
        const dropped = mergedProducts
          .filter(p => !categoryFiltered.includes(p))
          .slice(0, 3)
          .map(p => `"${p.name}" [${p.category}]`);
        LOG.info(`Filter dropped ${beforeFilter - categoryFiltered.length} products. Sample: ${dropped.join(', ')}`);
      }

      if (categoryFiltered.length > 0) {
        mergedProducts = categoryFiltered;
      } else {
        // Filter removed everything. Since all MCP products return "General",
        // this means no products came back at all — keep empty (nothing to show).
        const receivedCats = [...new Set(mergedProducts.map(p => p.category).filter(Boolean))];
        LOG.warn(
          `Post-merge filter "${filterCategory}" matched NOTHING. ` +
          `Received categories: ${receivedCats.join(', ')}. ` +
          `Keeping all ${mergedProducts.length} products.`,
        );
        // Keep all — better to show something than nothing
      }
    } else if (skipFilter && filterCategory) {
      LOG.info(`Post-merge filter skipped — "${filterCategory}" is not a real MCP category filter`);
    }

    // ── Category diversification (only when no specific category was requested) ─
    // When the original query was category:null (or General was discovered, meaning
    // no real filter exists), spread results across categories for variety.
    if ((!sp.category || !discoveredCategory) && mergedProducts.length > 0) {
      const buckets: Record<string, Product[]> = {};
      for (const item of mergedProducts) {
        const cat = item.category || 'Other';
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(item);
      }

      const sortedCats      = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length);
      const diverseResult:  Product[] = [];
      const limits          = [20, 15, 10, 5];

      for (let i = 0; i < sortedCats.length; i++) {
        diverseResult.push(...buckets[sortedCats[i]].splice(0, limits[i] ?? 2));
      }
      for (const cat of sortedCats) {
        if (diverseResult.length >= 50) break;
        diverseResult.push(...buckets[cat].splice(0, 50 - diverseResult.length));
      }

      const bucketSummary = Object.fromEntries(
        sortedCats.map(c => [c, (buckets[c].length || 0) + diverseResult.filter(p => p.category === c).length])
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

    if (products.length > 0) {
      const preview = products
        .slice(0, 3)
        .map((p, i) => `  [${i + 1}] "${p.name}" (${p.category}) LKR ${p.price}`)
        .join('\n');
      LOG.info(`Top 3 results:\n${preview}`);
    }

    return NextResponse.json({ products, quantum });

  } catch (e) {
    LOG.error('Unhandled search error', e);
    return NextResponse.json({ products: [], quantum: false });
  }
}