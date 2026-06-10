import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeProduct } from '@/lib/security';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

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

    // Collect ALL kapruka.com URLs in this block, then separate them
    const allUrls = [...block.matchAll(/https?:\/\/(?:www\.)?kapruka\.com[^\s)\]"'\\<>]*/g)]
      .map(m => m[0]);

    const imgUrl     = allUrls.find(u => /productImages|\.jpg|\.jpeg|\.png|\.webp/i.test(u)) ?? '';
    const productUrl = allUrls.find(u => !/productImages|\.jpg|\.jpeg|\.png|\.webp/i.test(u)) ?? '';

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

async function mcpSearch(q: string, sid: string, maxPrice?: number): Promise<Record<string, unknown>[]> {
  const args: Record<string, unknown> = {
    q: q.slice(0, 100), limit: 12, currency: 'LKR',
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
  console.log('RAW search:', text.slice(0, 200));
  const m    = text.match(/^data:\s*(.+)$/m);
  const json = m ? m[1] : text;

  try {
    const data = JSON.parse(json) as { result?: { content?: { text?: string }[] } };
    const raw  = data?.result?.content?.[0]?.text ?? '';
    try {
      const parsed = JSON.parse(raw);
      return (parsed.results || parsed.products || []) as Record<string, unknown>[];
    } catch {
      // MCP returned Markdown — parse it
      return parseMarkdownSearch(raw);
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

  // Parse "query | max_price:N | category:X" format
  const parts     = primary.split('|');
  const baseQuery = parts[0].trim();
  const maxPrice  = primary.match(/max_price:(\d+)/)?.[1] ? Number(primary.match(/max_price:(\d+)/)![1]) : undefined;

  // Generate query variations to get more diverse results
  const words = baseQuery.split(' ').filter(w => w.length > 2);
  const q2    = words.length > 2 ? words.slice(0, 2).join(' ') : baseQuery;   // shorter
  const q1Broader = words[0] ?? baseQuery;                                      // broadest

  try {
    const sid = await mcpSession();
    console.log('Searching:', baseQuery, '|', q2, '|', q1Broader);

    const r1 = await mcpSearch(baseQuery, sid, maxPrice);
    const r2 = q2 !== baseQuery ? await mcpSearch(q2, sid, maxPrice) : [];
    const r3 = q1Broader !== q2 && q1Broader !== baseQuery ? await mcpSearch(q1Broader, sid, maxPrice) : [];

    console.log('MCP counts:', r1.length, r2.length, r3.length);

    const seen = new Set<string>();
    const products = [...r1, ...r2, ...r3]
      .map(sanitizeProduct)
      .filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true; // trust MCP ranking
      })
      .slice(0, 8);

    return NextResponse.json({ products, quantum: products.length > 0 });
  } catch (e) {
    console.error('Search error:', e);
    return NextResponse.json({ products: [], quantum: false });
  }
}