/**
 * GET /api/categories
 * Calls kapruka_list_categories with response_format:"json"
 * Returns cleaned, emoji-labelled category list with 60-min cache.
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
  id?: string | number;
  name?: string;
  slug?: string;
  title?: string;
  label?: string;
  description?: string;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (!rateLimit(`categories:${ip}`, 30, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const key = cacheKey('categories', 'all');
  const hit = cacheGet<unknown[]>(key);
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
          /* response_format:"json" returns structured category list */
          arguments: { params: { response_format: 'json' } },
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

    /* Parse JSON from MCP */
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch {
      console.error('categories: non-JSON response', raw.slice(0, 120));
      return NextResponse.json({ error: 'Non-JSON categories' }, { status: 500 });
    }

    /* Normalise — handle both array and { categories: [] } shapes */
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

    console.log(`[categories] fetched ${rawCats.length} from MCP`);

    const categories = rawCats
      .map(c => ({
        name:  (c.name ?? c.title ?? c.label ?? '').trim(),
        emoji: getEmoji(c.name ?? c.title ?? c.label ?? ''),
        /* query = natural language sent to the chat when user clicks */
        query: `Show me ${(c.name ?? c.title ?? c.label ?? '').toLowerCase()} products on Kapruka`,
        id:    String(c.id ?? c.slug ?? c.name ?? ''),
      }))
      .filter(c => c.name.length > 0);

    cacheSet(key, categories, TTL.CITIES); /* 60-min cache */
    return NextResponse.json({ categories });
  } catch (e) {
    console.error('categories error:', e);
    return NextResponse.json({ error: 'Could not fetch categories' }, { status: 500 });
  }
}
