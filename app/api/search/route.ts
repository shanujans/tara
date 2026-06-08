import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeProduct } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

function parseSSE(text: string): Record<string, unknown> {
  const match = text.match(/^data:\s*(.+)$/m);
  if (!match) return {};
  return JSON.parse(match[1]);
}

async function getSession(): Promise<string> {
  const r = await fetch(MCP, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'initialize',
      params: { protocolVersion: '2024-11-05', clientInfo: { name: 'tara', version: '1.0' }, capabilities: {} },
    }),
  });
  const sid = r.headers.get('mcp-session-id');
  await r.text();
  if (!sid) throw new Error('No session ID');
  return sid;
}

async function mcpSearch(q: string, sid: string, maxPrice?: number): Promise<Record<string, unknown>[]> {
  const args: Record<string, unknown> = { q: q.slice(0, 100), limit: 8, currency: 'LKR', response_format: 'json' };
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
  const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
  const raw = data?.result?.content?.[0]?.text;
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return (parsed.results || []) as Record<string, unknown>[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ products: [] }, { status: 429 });
  }

  let body: { primary?: string; alternative?: string; creative?: string; budget?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ products: [] }, { status: 400 });
  }

  const { primary, alternative, creative, budget } = body;
  if (!primary || primary.length < 2) {
    return NextResponse.json({ products: [] }, { status: 400 });
  }

  try {
    const sid = await getSession();
    const [r1, r2, r3] = await Promise.all([
      mcpSearch(primary, sid, budget),
      mcpSearch(alternative ?? primary, sid),
      mcpSearch(creative ?? primary, sid),
    ]);

    const seen = new Set<string>();
    const products = [...r1, ...r2, ...r3]
      .map(sanitizeProduct)              // sanitize ALL MCP data
      .filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 8);

    return NextResponse.json({ products, quantum: true });
  } catch {
    return NextResponse.json({ products: [], quantum: false });
  }
}