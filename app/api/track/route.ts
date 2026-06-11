import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

function parseSSE(text: string): Record<string, unknown> {
  const m = text.match(/^data:\s*(.+)$/m);
  if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
  try { return JSON.parse(text); } catch { return {}; }
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
  if (!sid) throw new Error('No session');
  return sid;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ status: null, error: 'Too many requests' }, { status: 429 });
  }

  let body: { order_number?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ status: null }); }

  const { order_number } = body;
  if (!order_number || !/^[A-Za-z0-9_-]{4,40}$/.test(order_number)) {
    return NextResponse.json({ status: null, error: 'Invalid order number' });
  }

  try {
    const sid = await getSession();

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '2', method: 'tools/call',
        params: { name: 'kapruka_track_order', arguments: { params: { order_number } } },
      }),
    });

    const text = await r.text();
    const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
    const raw  = data?.result?.content?.[0]?.text ?? '';

    // MCP may return JSON or plain-text status
    let status: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { status?: string; message?: string; steps?: string[]; eta?: string };
      status = parsed.status ?? parsed.message ?? null;
      if (!status && parsed.steps?.length) status = parsed.steps[parsed.steps.length - 1];
      if (status && parsed.eta) status += ` (ETA: ${parsed.eta})`;
    } catch {
      status = raw.slice(0, 200) || null;
    }

    return NextResponse.json({ status });
  } catch (e) {
    console.error('Track error:', e);
    return NextResponse.json({ status: null, error: 'Tracking unavailable' });
  }
}
