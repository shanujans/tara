export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { mcpSession } from '@/lib/mcp';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// Product type keywords to detect from the product name
const TYPE_WORDS = [
  'laptop','notebook','computer','pc','tablet','ipad',
  'phone','mobile','smartphone','iphone',
  'tv','television','monitor','screen',
  'camera','dslr','mirrorless',
  'headphone','earbuds','earphone','speaker',
  'watch','smartwatch',
  'refrigerator','fridge','washing','airconditioner',
  'printer','router','modem','keyboard','mouse',
  'gaming','console','playstation','xbox',
];

/**
 * Build the best search keyword for comparison:
 *   - brand + detected type  (e.g. "Lenovo laptop") — most precise
 *   - brand + model line     (e.g. "Lenovo Ideapad")  — fallback
 */
function buildKeyword(productName: string): string {
  const words  = productName.toLowerCase().split(/\s+/);
  const brand  = productName.split(/\s+/)[0] ?? '';           // first word = brand
  const found  = TYPE_WORDS.find(t => words.includes(t));
  if (found) return `${brand} ${found}`;                       // "Lenovo laptop"
  const model = productName.split(/\s+/).slice(0, 2).join(' ');// "Lenovo Ideapad"
  return model;
}

interface CompareProduct {
  id: string; name: string; price: number;
  image: string; url: string; category: string; in_stock: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { product_id, product_name, category } = await req.json() as {
      product_id?: string; product_name?: string; category?: string;
    };

    const keyword = buildKeyword(product_name ?? '');
    console.log('[TARA:COMPARE] keyword:', keyword, '| product_id:', product_id);

    const sid = await mcpSession();
    const r   = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0', id: String(Date.now()), method: 'tools/call',
        params: {
          name: 'kapruka_search_products',
          arguments: { params: {
            q:             keyword,
            category:      null,   // always null — display category ≠ search filter category
            limit:         8,
            in_stock_only: false,
            sort:          'relevance',
            response_format: 'json',
          }},
        },
      }),
    });

    const text = await r.text();
    const m    = text.match(/^data:\s*(.+)$/m);
    const raw  = JSON.parse(m ? m[1] : text)?.result?.content?.[0]?.text ?? '{}';

    let results: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const arr = parsed.results ?? parsed;
      if (Array.isArray(arr)) results = arr as Record<string, unknown>[];
    } catch { /* empty */ }

    // Exclude current product, cap at 4 (current product is row 1 in UI)
    const products: CompareProduct[] = results
      .filter(p => String(p.id ?? '') !== String(product_id ?? ''))
      .slice(0, 4)
      .map(p => {
        const priceObj = p.price as { amount?: number } | null;
        const catObj   = p.category as { name?: string } | null;
        return {
          id:       String(p.id       ?? ''),
          name:     String(p.name     ?? ''),
          price:    Number(priceObj?.amount ?? 0),
          image:    String(p.image_url ?? p.image ?? ''),
          url:      String(p.url      ?? ''),
          category: String(catObj?.name ?? category ?? ''),
          in_stock: Boolean(p.in_stock),
        };
      });

    console.log('[TARA:COMPARE] returning', products.length, 'comparison products');
    return NextResponse.json({ products });
  } catch (e) {
    console.error('[TARA:COMPARE]', e);
    return NextResponse.json({ products: [] });
  }
}
