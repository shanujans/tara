/**
 * lib/mcp.ts — server-side wrappers for all 7 Kapruka MCP tools.
 * Uses JSON-RPC 2.0 + SSE session protocol. Server-side only.
 */

const MCP_URL = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
};

function parseSSE(text: string): Record<string, unknown> {
  const m = text.match(/^data:\s*(.+)$/m);
  if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
  try { return JSON.parse(text); } catch { return {}; }
}

export async function mcpSession(): Promise<string> {
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'tara', version: '1.0' },
        capabilities: {},
      },
    }),
  });
  const sid = r.headers.get('mcp-session-id');
  await r.text();
  if (!sid) throw new Error('MCP: no session ID');
  return sid;
}

/** Returns parsed JSON — throws if response is not valid JSON */
async function callTool<T>(
  sid: string, name: string, params: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: { ...H, 'mcp-session-id': sid },
    body: JSON.stringify({
      jsonrpc: '2.0', id: String(Date.now()), method: 'tools/call',
      params: { name, arguments: { params } },
    }),
  });
  const text = await r.text();
  const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
  const raw  = data?.result?.content?.[0]?.text;
  if (!raw) throw new Error(`MCP tool ${name}: empty response`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`MCP tool ${name} returned non-JSON: ${raw.slice(0, 80)}`);
  }
}

/** Returns raw text — never throws on non-JSON. Use for Markdown-returning tools. */
async function callToolRaw(
  sid: string, name: string, params: Record<string, unknown>,
): Promise<string> {
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: { ...H, 'mcp-session-id': sid },
    body: JSON.stringify({
      jsonrpc: '2.0', id: String(Date.now()), method: 'tools/call',
      params: { name, arguments: { params } },
    }),
  });
  const text = await r.text();
  const data = parseSSE(text) as { result?: { content?: { text?: string }[] } };
  return data?.result?.content?.[0]?.text ?? '';
}

async function mcp<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const sid = await mcpSession();
  return callTool<T>(sid, name, params);
}

// ─── Shared types ────────────────────────────────────────────────────────────

export interface MProduct {
  id: string; name: string; price: number; image: string;
  url?: string; description?: string; stock?: boolean | string;
  in_stock?: boolean; category?: string; shipping?: string; images?: string[];
}
export interface MCategory { id?: string; name: string; slug?: string; }
export interface MCity     { name: string; id?: string; }
export interface MDelivery {
  available: boolean; fee?: number; delivery_fee?: number;
  eta?: string; message?: string;
}
export interface MOrder {
  order_ref?: string; checkout_url?: string;
  error?: string; summary?: { grand_total?: number };
}
export interface MTrack {
  status?: string; steps?: string[]; eta?: string; message?: string;
}

// ─── Delivery Markdown parser ─────────────────────────────────────────────────
// kapruka_check_delivery returns Markdown prose, not JSON.
function parseDeliveryMarkdown(md: string): MDelivery {
  const lower = md.toLowerCase();

  // Availability — check negatives first
  const unavailable = /not\s+available|unavailable|cannot\s+deliver|not\s+serviceable|no\s+delivery|not\s+covered|outside.*service/i.test(md);
  const available   = !unavailable && /\bavailable\b|can\s+be\s+deliver|yes\b|possible|serviceable/i.test(md);

  // Fee — try multiple patterns
  const feePatterns = [
    /delivery\s+fee[:\s]*(?:lkr|rs\.?)?\s*([\d,]+)/i,
    /fee[:\s]*(?:lkr|rs\.?)?\s*([\d,]+)/i,
    /(?:lkr|rs\.?)\s*([\d,]+)/i,
    /([\d,]+)\s*(?:lkr|rs)/i,
  ];
  let fee: number | undefined;
  for (const pat of feePatterns) {
    const m = md.match(pat);
    if (m) { fee = Number(m[1].replace(/,/g, '')); if (fee > 0) break; }
  }

  // ETA
  const etaMatch = md.match(/(?:eta|estimated\s+(?:delivery|time)|deliver(?:ed|y)\s+(?:by|within|in))[:\s]+([^\n.]+)/i)
                ?? md.match(/(?:same.day|next.day|tomorrow|today|days?|business\s+days?)[^\n]*/i);
  const eta = etaMatch?.[0]?.trim().slice(0, 100);

  // Message — try to grab a useful line
  const msgLine = md.split('\n').find(l => l.trim().length > 15 && !/^\*\*|^#/.test(l.trim()));

  return {
    available,
    ...(fee !== undefined ? { fee } : {}),
    ...(eta  ? { eta }     : {}),
    message: unavailable
      ? (msgLine?.trim() || 'Delivery not available to this city on the selected date.')
      : (msgLine?.trim() || undefined),
  };
}

// ─── Tool 1 — Search products ─────────────────────────────────────────────────
export async function searchProducts(params: {
  q: string; category?: string; min_price?: number; max_price?: number;
  in_stock_only?: boolean; sort?: string; limit?: number; currency?: string;
}): Promise<{ results: MProduct[] }> {
  return mcp('kapruka_search_products', {
    ...params,
    limit:        params.limit        ?? 12,
    in_stock_only:params.in_stock_only ?? true,
    sort:         params.sort          ?? 'relevance',
    currency:     params.currency      ?? 'LKR',
  });
}

// ─── Tool 2 — Get product details ─────────────────────────────────────────────
export async function getProduct(product_id: string, currency = 'LKR'): Promise<MProduct> {
  return mcp('kapruka_get_product', { product_id, currency });
}

// ─── Tool 3 — List categories ──────────────────────────────────────────────────
export async function listCategories(depth = 1): Promise<{ categories: MCategory[] }> {
  return mcp('kapruka_list_categories', { depth });
}

// ─── Tool 4 — List delivery cities ────────────────────────────────────────────
export async function listDeliveryCities(query: string, limit = 10): Promise<{ cities: MCity[] }> {
  return mcp('kapruka_list_delivery_cities', { query, limit });
}

// ─── Tool 5 — Check delivery (returns Markdown, not JSON) ─────────────────────
export async function checkDelivery(params: {
  city: string; delivery_date: string; product_id?: string;
}): Promise<MDelivery> {
  const sid = await mcpSession();
  const raw = await callToolRaw(sid, 'kapruka_check_delivery', params);

  if (!raw) return { available: false, message: 'No response from delivery service.' };

  // Try JSON first (in case MCP starts returning it)
  try {
    const j = JSON.parse(raw) as MDelivery;
    if (typeof j.available === 'boolean') return j;
  } catch { /* fall through to Markdown parser */ }

  return parseDeliveryMarkdown(raw);
}

// ─── Tool 6 — Create order ────────────────────────────────────────────────────
export async function createOrder(params: {
  cart: { product_id: string; quantity: number }[];
  recipient: { name: string; phone: string };
  delivery: { address: string; city: string; date: string; location_type?: string };
  sender?: { name: string; anonymous?: boolean };
  gift_message?: string | null;
  currency?: string;
}): Promise<MOrder> {
  return mcp('kapruka_create_order', {
    ...params,
    currency:        params.currency ?? 'LKR',
    response_format: 'json',
  });
}

// ─── Tool 7 — Track order ─────────────────────────────────────────────────────
export async function trackOrder(order_number: string): Promise<MTrack> {
  return mcp('kapruka_track_order', { order_number });
}
