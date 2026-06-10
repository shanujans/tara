import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// MCP returns Markdown like:
// ## Kapruka delivery cities — 'query' (N of N)
// - **CityName**  _aliases: ...
function parseMarkdownCities(md: string): { name: string }[] {
  const cities: { name: string }[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^-\s+\*\*(.+?)\*\*/);
    if (m) cities.push({ name: m[1].trim() });
  }
  return cities;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 120, 60_000)) return NextResponse.json({ cities: [] }, { status: 429 });

  let body: { query?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ cities: [] }); }

  const query = (body.query ?? '').trim().slice(0, 60);
  if (query.length < 2) return NextResponse.json({ cities: [] });

  try {
    const sid = await mcpSession();
    const r   = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0', id: String(Date.now()), method: 'tools/call',
        params: { name: 'kapruka_list_delivery_cities', arguments: { params: { query, limit: 25 } } },
      }),
    });

    const text = await r.text();
    const m    = text.match(/^data:\s*(.+)$/m);
    const raw  = m ? m[1] : text;

    let content = '';
    try {
      const data = JSON.parse(raw) as { result?: { content?: { text?: string }[] } };
      content = data?.result?.content?.[0]?.text ?? '';
    } catch { return NextResponse.json({ cities: [] }); }

    // Try JSON first, fall back to Markdown
    let cities: { name: string }[] = [];
    try {
      const parsed = JSON.parse(content);
      cities = parsed.cities ?? parsed.results ?? [];
    } catch {
      cities = parseMarkdownCities(content);
    }

    return NextResponse.json({ cities: cities.slice(0, 25) });
  } catch {
    return NextResponse.json({ cities: [] });
  }
}
