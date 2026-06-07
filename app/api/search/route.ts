import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL!;
const HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

async function getSession(): Promise<string> {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'initialize',
      params: { protocolVersion: '2024-11-05', clientInfo: { name: 'tara', version: '1.0' }, capabilities: {} },
    }),
  });
  const sessionId = r.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('No session ID');
  return sessionId;
}

async function mcpSearch(q: string, sessionId: string, maxPrice?: number) {
  try {
    const args: Record<string, unknown> = { q, limit: 8, currency: 'LKR', response_format: 'json' };
    if (maxPrice) args.max_price = maxPrice;

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...HEADERS, 'mcp-session-id': sessionId },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '2', method: 'tools/call',
        params: { name: 'kapruka_search_products', arguments: { params: args } },
      }),
    });
    const text = await r.text();
    const match = text.match(/^data:\s*(.+)$/m);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const raw = data?.result?.content?.[0]?.text;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (parsed.results || []) as Record<string, unknown>[];
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  const { primary, alternative, creative, budget } = await req.json();

  try {
    const sessionId = await getSession();

    const [r1, r2, r3] = await Promise.all([
      mcpSearch(primary, sessionId, budget),
      mcpSearch(alternative, sessionId),
      mcpSearch(creative, sessionId),
    ]);

    const seen = new Set<string>();
    const products = [...r1, ...r2, ...r3]
      .filter(p => {
        const id = String(p.id ?? '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 8)
      .map(p => ({
        id: String(p.id ?? Math.random()),
        name: String(p.name ?? ''),
        price: Number((p.price as Record<string,unknown>)?.amount ?? p.price ?? 0),
        image: String(p.image_url ?? ''),
        url: String(p.url ?? ''),
      }));

    return NextResponse.json({ products, quantum: true });
  } catch (e) {
    console.error('MCP error:', e);
    return NextResponse.json({ products: [], quantum: false });
  }
}