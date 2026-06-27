/**
 * GET /api/categories
 * Calls kapruka_list_categories with response_format:"json" and depth:2
 * Returns cleaned, emoji-labelled category list (with subcategories) with 60-min cache.
 *
 * GET /api/categories?sub=<encoded_kapruka_url>
 * Scrapes that Kapruka subcategory page for level-3 sub-subcategories.
 * Uses regex to find /lanka/ links — no extra npm packages needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { cacheGet, cacheSet, cacheKey, TTL } from '@/lib/cache';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

/* Emoji mapping — prefix-matched against lowercase category name */
const EMOJI_MAP: [string, string][] = [
  ['flower',      '💐'], ['rose',        '🌹'], ['plant',       '🌱'],
  ['cake',        '🎂'], ['bakery',       '🧁'], ['dessert',      '🍰'],
  ['chocolate',   '🍫'], ['sweet',        '🍬'], ['candy',        '🍭'],
  ['gift',        '🎁'], ['hamper',       '🧺'], ['occasion',     '🎊'],
  ['electronic',  '📱'], ['mobile',       '📱'], ['phone',        '📱'],
  ['laptop',      '💻'], ['computer',     '💻'], ['gadget',       '⌨️'],
  ['fashion',     '👗'], ['cloth',        '👚'], ['apparel',      '🧥'],
  ['jewel',       '💍'], ['ring',         '💍'], ['watch',        '⌚'],
  ['book',        '📚'], ['stationery',   '✏️'], ['office',       '🗂️'],
  ['toy',         '🎮'], ['game',         '🎯'], ['sport',        '⚽'],
  ['grocery',     '🛒'], ['food',         '🍜'], ['rice',         '🍚'],
  ['tea',         '🍵'], ['coffee',       '☕'], ['wine',         '🍷'],
  ['health',      '💊'], ['beauty',       '💄'], ['medicine',     '🏥'],
  ['home',        '🏠'], ['decor',        '🪴'], ['kitchen',      '🍳'],
  ['travel',      '✈️'], ['hotel',        '🏨'], ['experience',   '🎡'],
  ['pet',         '🐾'], ['baby',         '👶'], ['kids',         '🧸'],
];

function getEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of EMOJI_MAP) if (lower.includes(key)) return emoji;
  return '🛍️';
}

interface RawCategory {
  id?:          string | number;
  name?:        string;
  slug?:        string;
  title?:       string;
  label?:       string;
  description?: string;
  url?:         string;            // ← Kapruka page URL returned by MCP
  children?:    RawCategory[];
}

interface Category {
  id:      string;
  name:    string;
  emoji:   string;
  query:   string;
  url?:    string;                 // ← Kapruka page URL (used for level-3 scraping)
  parent?: string;
}

/* Level-3 subcategory item (returned by ?sub= endpoint) */
interface Level3Item {
  name:  string;
  url:   string;
  emoji: string;
  query: string;
}

/* Recursively flatten categories + their children into a single list. */
function flattenCategories(cats: RawCategory[], parent?: string): Category[] {
  return cats.flatMap(c => {
    const name = (c.name ?? c.title ?? c.label ?? '').trim();
    if (!name) return [];

    const self: Category = {
      id:    parent ? `${parent}::${name}` : String(c.id ?? c.slug ?? name),
      name,
      emoji: getEmoji(name),
      query: `Show me ${name.toLowerCase()} products on Kapruka`,
      /* Preserve the URL so SidePanel can request level-3 scraping */
      ...(c.url ? { url: c.url } : {}),
      ...(parent ? { parent } : {}),
    };

    const children = Array.isArray(c.children)
      ? flattenCategories(c.children, name)
      : [];

    return [self, ...children];
  });
}

/**
 * Scrape level-3 sub-subcategories from a Kapruka category page.
 *
 * Kapruka renders them as filter pills at the top of each subcategory
 * listing. Their hrefs follow the pattern:
 *   /online/{cat}/price/{subcat}/lanka/{sub_subcat}
 *
 * We fetch the page HTML and regex-extract all such links.
 * No npm package required — built-in fetch + regex only.
 */
async function scrapeLevel3(pageUrl: string): Promise<Level3Item[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://www.kapruka.com/',
      },
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    const html = await res.text();

    /*
     * Match anchor tags whose href contains /lanka/ — these are level-3 links.
     * Pattern: href="/online/{cat}/price/{subcat}/lanka/{sub}"...>{text}</a>
     *
     * Two passes:
     *  1. Extract all /lanka/ hrefs
     *  2. For each href, find its anchor text by locating it in the HTML
     */
    const hrefRe  = /href="(\/online\/[^"]+\/lanka\/[^"]+)"/g;
    const seen    = new Set<string>();
    const results: Level3Item[] = [];

    let hm: RegExpExecArray | null;
    while ((hm = hrefRe.exec(html)) !== null) {
      const href = hm[1];
      if (seen.has(href)) continue;
      seen.add(href);

      /* Find the text content of the anchor that contains this href.
         Look ahead up to 300 chars from the href position for ">...text...</" */
      const pos      = hm.index;
      const snippet  = html.slice(pos, pos + 300);

      /* Match:  >  optional whitespace/tags  text  < */
      const txtMatch = snippet.match(/>[^<]*>?\s*([A-Za-z0-9][^<\n\r]{1,70}?)\s*<\/a>/);
      const rawName  = txtMatch ? txtMatch[1].trim() : '';

      /* Decode common HTML entities */
      const name = rawName
        .replace(/&amp;/g,   '&')
        .replace(/&apos;/g,  "'")
        .replace(/&#039;/g,  "'")
        .replace(/&quot;/g,  '"')
        .replace(/&lt;/g,    '<')
        .replace(/&gt;/g,    '>')
        .trim();

      /* Skip empty, too-short, or UI-noise strings */
      if (!name || name.length < 2 || name.length > 80) continue;
      if (/^(home|back|more|all items|view all|sort|filter|clear|search)$/i.test(name)) continue;

      results.push({
        name,
        url:   `https://www.kapruka.com${href}`,
        emoji: getEmoji(name),
        query: `Show me ${name.toLowerCase()} on Kapruka`,
      });
    }

    return results;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';

  /* ─────────────────────────────────────────────────────────────
   *  ?sub=<encoded URL>  →  on-demand level-3 scrape
   *  Called by SidePanel when user taps a level-2 category.
   * ───────────────────────────────────────────────────────────── */
  const subUrl = req.nextUrl.searchParams.get('sub');
  if (subUrl) {
    /* Basic allowlist check — only scrape kapruka.com pages */
    if (!subUrl.startsWith('https://www.kapruka.com/')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!rateLimit(`categories-sub:${ip}`, 20, 60_000))
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    /* Cache each subcategory page individually for 60 min */
    const subKey   = cacheKey('level3', subUrl);
    const subCached = cacheGet<Level3Item[]>(subKey);
    if (subCached) {
      console.log('[cache HIT] level3', subUrl);
      return NextResponse.json({ subcategories: subCached });
    }

    const subcategories = await scrapeLevel3(subUrl);
    console.log(`[level3] scraped ${subcategories.length} items from ${subUrl}`);

    if (subcategories.length > 0) cacheSet(subKey, subcategories, TTL.CITIES);
    return NextResponse.json({ subcategories });
  }

  /* ─────────────────────────────────────────────────────────────
   *  Default  →  MCP level-1 + level-2 categories (unchanged)
   * ───────────────────────────────────────────────────────────── */
  if (!rateLimit(`categories:${ip}`, 30, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const key = cacheKey('categories', 'all');
  const hit = cacheGet<Category[]>(key);
  if (hit) { console.log('[cache HIT] categories'); return NextResponse.json({ categories: hit }); }

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
          name: 'kapruka_list_categories',
          arguments: { params: { response_format: 'json', depth: 2 } },
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
      return NextResponse.json({ error: 'MCP parse error' }, { status: 500 });
    }

    if (!raw) return NextResponse.json({ error: 'Empty MCP response' }, { status: 500 });

    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch {
      console.error('categories: non-JSON response', raw.slice(0, 120));
      return NextResponse.json({ error: 'Non-JSON categories' }, { status: 500 });
    }

    let rawCats: RawCategory[] = [];
    if (Array.isArray(parsed)) {
      rawCats = parsed as RawCategory[];
    } else if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      rawCats = (
        Array.isArray(p.categories) ? p.categories :
        Array.isArray(p.data)       ? p.data       :
        Array.isArray(p.items)      ? p.items       :
        []
      ) as RawCategory[];
    }

    console.log(`[categories] fetched ${rawCats.length} top-level from MCP`);

    const categories = flattenCategories(rawCats);

    console.log(`[categories] ${categories.length} total after flattening subcategories`);

    cacheSet(key, categories, TTL.CITIES);
    return NextResponse.json({ categories });
  } catch (e) {
    console.error('categories error:', e);
    return NextResponse.json({ error: 'Could not fetch categories' }, { status: 500 });
  }
}