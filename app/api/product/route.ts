import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// kapruka_get_product returns Markdown, not JSON — parse it manually
function parseMarkdownProduct(md: string, productId: string) {
  const name     = md.match(/^##\s+(.+)/m)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const price    = Number(md.match(/\*\*Price\*\*[^:]*:\s*LKR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
  const stock    = md.match(/\*\*Stock\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const category = md.match(/\*\*Category\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const vendor   = md.match(/\*\*Vendor\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const weight   = md.match(/\*\*Weight\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';
  const rating   = md.match(/\*\*Rating\*\*[^:]*:\s*(.+)/i)?.[1]?.trim() ?? '';

  // URL — look for any Kapruka link in the Markdown
  const urlInMd  = md.match(/https?:\/\/(?:www\.)?kapruka\.com[^\s)\]"'\\]*/)?.[0] ?? '';

  // Image — markdown image syntax or explicit field
  const imgInMd  = md.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)?.[1]
                ?? md.match(/\*\*Image[^:]*\*\*[^:]*:\s*(https?:\/\/\S+)/i)?.[1]
                ?? '';

  // Description / summary — multiline block
  const desc = md.match(/\*\*(?:Description|Summary)\*\*[^:]*:\s*([\s\S]+?)(?=\n\*\*|\n##|$)/i)?.[1]?.trim() ?? '';

  const shipping = [
    vendor && `Sold by ${vendor}`,
    weight && weight !== '0 lb' && `Weight: ${weight}`,
    rating && `Rating: ${rating}`,
  ].filter(Boolean).join(' · ');

  return {
    id:          productId,
    name:        name || `Product ${productId}`,
    price,
    in_stock:    /in.?stock/i.test(stock),
    stock:       stock,
    category,
    shipping:    shipping || undefined,
    url:         urlInMd || `https://www.kapruka.com`,
    image:       imgInMd,
    images:      imgInMd ? [imgInMd] : [],
    description: desc || (category ? `${category} product${vendor ? ` by ${vendor}` : ''}` : undefined),
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  let body: { product_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { product_id } = body;
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 });

  const safeId = product_id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);

  try {
    const sid = await mcpSession();

    const r = await fetch(MCP, {
      method: 'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: String(Date.now()),
        method: 'tools/call',
        params: { name: 'kapruka_get_product', arguments: { params: { product_id: safeId, currency: 'LKR' } } },
      }),
    });

    const text  = await r.text();
    const m     = text.match(/^data:\s*(.+)$/m);
    const json  = m ? m[1] : text;

    let raw = '';
    try {
      const data = JSON.parse(json) as { result?: { content?: { text?: string }[] } };
      raw = data?.result?.content?.[0]?.text ?? '';
    } catch {
      return NextResponse.json({ error: 'MCP parse error' }, { status: 500 });
    }

    if (!raw) return NextResponse.json({ error: 'Empty response' }, { status: 500 });

    // Try JSON first; fall back to Markdown parser
    let product: Record<string, unknown>;
    try {
      product = JSON.parse(raw);
    } catch {
      // kapruka_get_product returns Markdown — parse it
      product = parseMarkdownProduct(raw, safeId);
    }

    return NextResponse.json({ product });
  } catch (e) {
    console.error('getProduct error:', e);
    return NextResponse.json({ error: 'Could not fetch product' }, { status: 500 });
  }
}