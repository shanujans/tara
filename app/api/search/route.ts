import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '@/lib/cache';

async function mcpSearch(query: string) {
  const cached = cacheGet<Record<string, unknown>[]>(query);
  if (cached) return cached;

  try {
    const r = await fetch(process.env.MCP_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'search_products', params: { query, limit: 8 } }),
    });
    const data = await r.json();
    const results = (data.products || data.results || data.data || []) as Record<string, unknown>[];
    cacheSet(query, results);
    return results;
  } catch {
    return [];
  }
}

function scoreProduct(p: Record<string, unknown>, budget?: number) {
  const relevance = Number(p.relevance ?? 0.7);
  const rating    = Math.min(Number(p.rating ?? 3.5) / 5, 1);
  const speed     = Number(p.delivery_days ?? 3) <= 2 ? 1 : 0.5;
  const price     = Number(p.price ?? 0);
  const budgetFit = budget ? Math.max(0, 1 - Math.abs(price - budget) / budget) : 0.7;
  return (relevance * 0.4) + (budgetFit * 0.3) + (rating * 0.2) + (speed * 0.1);
}

export async function POST(req: NextRequest) {
  const { primary, alternative, creative, budget } = await req.json();

  const [r1, r2, r3] = await Promise.all([
    mcpSearch(primary), mcpSearch(alternative), mcpSearch(creative),
  ]);

  const seen = new Set<string>();
  const merged = [...r1, ...r2, ...r3].filter(p => {
    const id = String(p.id ?? p.product_id ?? '');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const scored = merged
    .map(p => ({
      id:    String(p.id ?? p.product_id ?? Math.random()),
      name:  String(p.name ?? p.title ?? ''),
      price: Number(p.price ?? 0),
      image: String(p.image ?? p.imageUrl ?? ''),
      url:   String(p.url ?? ''),
      _score: scoreProduct(p, budget),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  return NextResponse.json({ products: scored, quantum: true });
}