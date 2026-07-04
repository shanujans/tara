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

// ─── Session cache ─────────────────────────────────────────────────────────
// The Kapruka MCP server appears to rate-limit new session creation. Previously every
// single tool call (search, delivery, product, categories, checkout...) minted a brand
// new session via a fresh `initialize` handshake — across a busy app that's a LOT of
// `initialize` calls, and is almost certainly what was tripping "Rate limit exceeded"
// upstream. Cache the session ID and reuse it; only re-initialize when we don't have
// one, it's stale, or a caller explicitly needs a fresh one (e.g. after a failed call).
//
// NOTE: this cache is module-scoped, so it's reused across calls within the same warm
// serverless instance, but not shared across cold starts / other concurrent instances.
// That's a real limitation of this environment (same tradeoff lib/cache.ts already
// makes) — it cuts `initialize` calls dramatically without needing external storage.
let cachedSid: string | null = null;
let cachedAt  = 0;
const SESSION_TTL_MS = 5 * 60_000; // conservative guess — tune if Kapruka documents a real TTL

async function initSession(): Promise<string> {
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

/** Returns a cached MCP session ID, reusing it across calls. Pass `forceNew` to bypass
 *  the cache — e.g. when a previous call using the cached session just failed and might
 *  be due to an expired/invalid session. */
export async function mcpSession(forceNew = false): Promise<string> {
  const isFresh = cachedSid !== null && (Date.now() - cachedAt) < SESSION_TTL_MS;
  if (!forceNew && isFresh) return cachedSid as string;
  const sid = await initSession();
  cachedSid = sid;
  cachedAt  = Date.now();
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

async function mcp<T>(name: string, params: Record<string, unknown>, _retrying = false): Promise<T> {
  const sid = await mcpSession(_retrying);
  try {
    return await callTool<T>(sid, name, params);
  } catch (err) {
    if (_retrying) throw err;
    // One bounded retry with a guaranteed-fresh session — covers both a stale cached
    // session and a transient upstream hiccup (e.g. rate limiting).
    await new Promise(res => setTimeout(res, 300));
    return mcp<T>(name, params, true);
  }
}

// ─── Shared types ────────────────────────────────────────────────────────────

export interface MProduct {
  id: string; name: string; price: number; image: string;
  url?: string; description?: string; stock?: boolean | string;
  in_stock?: boolean; category?: string; shipping?: string; images?: string[];
}
export interface MCategory { id?: string; name: string; slug?: string; }
export interface MCity     { name: string; id?: string; }
export interface DeliveryOption {
  type: 'express' | 'standard';
  label: string;   // "Deliver on 13 / June"
  fee:   number;   // 610
}
export interface MDelivery {
  available: boolean;
  options?: DeliveryOption[];   // multiple tiers (express / standard)
  fee?: number; delivery_fee?: number;
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
function parseFee(s: string): number | null {
  const n = Number(s.replace(/,/g, ''));
  return (n >= 0 && n <= 10000) ? n : null; // 0 = explicitly free
}

function parseDeliveryMarkdown(md: string): MDelivery {
  // Availability
  const unavailable = /not\s+available|unavailable|cannot\s+deliver|not\s+serviceable|no\s+delivery|not\s+covered|outside.*service/i.test(md);
  const available   = !unavailable && /\bavailable\b|can\s+be\s+deliver|yes\b|possible|serviceable/i.test(md);

  const options: DeliveryOption[] = [];

  // ── Pattern A: "Deliver on DD / Month   Fee: Rs 610"  (Kapruka's exact format)
  const exprA = md.match(/deliver\s+on\s+([\d]+\s*[\/\-]\s*\w+(?:\s*\/\s*\d+)?)[^\n]*?(?:fee[:\s]+)?(?:rs\.?|lkr)\s*([\d,]+)/i);
  if (exprA) {
    const fee = parseFee(exprA[2]);
    if (fee) options.push({ type: 'express', label: `Deliver on ${exprA[1].trim()}`, fee });
  }

  // ── Pattern B: "Deliver within 3 to 5 days  Fee: Rs 480"
  const stdA = md.match(/deliver\s+within\s+([\d\w\s]+?days?)[^\n]*?(?:fee[:\s]+)?(?:rs\.?|lkr)\s*([\d,]+)/i);
  if (stdA) {
    const fee = parseFee(stdA[2]);
    if (fee) options.push({ type: 'standard', label: `Deliver within ${stdA[1].trim()}`, fee });
  }

  // ── Pattern C: generic express/standard labels with fees on same line
  if (options.length === 0) {
    for (const line of md.split('\n')) {
      const feeM = line.match(/(?:rs\.?|lkr)\s*([\d,]+)/i);
      if (!feeM) continue;
      const fee = parseFee(feeM[1]);
      if (!fee) continue;
      if (/express|next.?day|same.?day|deliver\s+on/i.test(line) && !options.find(o => o.type === 'express')) {
        options.push({ type: 'express', label: 'Express delivery', fee });
      } else if (/standard|regular|within|days?/i.test(line) && !options.find(o => o.type === 'standard')) {
        options.push({ type: 'standard', label: 'Standard delivery', fee });
      }
    }
  }

  // ── Fallback: single fee when no options found
  let fee: number | undefined;
  if (options.length === 0) {
    const patterns = [
      /flat\s+rate\s+(?:lkr|rs\.?)\s*([\d,]+)/i,                          // "flat rate LKR 300"  ← Kapruka's most common format
      /—\s*(?:lkr|rs\.?)\s*([\d,]+)/i,                                     // "Available — LKR 300"
      /delivery\s+(?:fee|charge|cost)[:\s]*(?:lkr|rs\.?)?\s*([\d,]+)/i,
      /shipping\s+(?:fee|charge|cost)[:\s]*(?:lkr|rs\.?)?\s*([\d,]+)/i,
      /(?:fee|charge|cost)[:\s]+(?:lkr|rs\.?)\s*([\d,]+)/i,
      /(?:lkr|rs\.?)\s*([\d,]+)\s*(?:delivery|shipping|flat)/i,
    ];
    for (const pat of patterns) {
      const m = md.match(pat);
      if (m) {
        const n = Number(m[1].replace(/,/g, ''));
        if (n >= 0 && n <= 10000) { fee = n; break; } // 0 = free delivery is valid
      }
    }
  }

  const msgLine = md.split('\n').find(l => l.trim().length > 15 && !/^\*\*|^#/.test(l.trim()));

  return {
    available,
    ...(options.length > 0 ? { options, fee: options[0].fee } : {}),
    ...(fee !== undefined ? { fee } : {}),
    message: unavailable
      ? (msgLine?.trim() || 'Delivery not available to this city on the selected date.')
      : undefined,
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
const MCP_UPSTREAM_ERROR_RE = /rate limit|too many requests|internal server error|service unavailable|please try again|temporarily unavailable/i;

export async function checkDelivery(params: {
  city: string; delivery_date: string; product_id?: string;
}, _retrying = false): Promise<MDelivery> {
  const sid = await mcpSession(_retrying);
  const raw = await callToolRaw(sid, 'kapruka_check_delivery', params);

  // Log raw so we can see exactly what Kapruka returns
  console.log('[delivery raw]', raw.slice(0, 400));

  // BUG FIX: an upstream error/rate-limit response (plain text, not real Markdown) used to
  // fall straight into parseDeliveryMarkdown() and silently become a fabricated "not
  // available" answer — which the caller then CACHED, serving a wrong delivery result to
  // real customers until the cache entry expired. Detect it and retry once with a
  // guaranteed-fresh session before giving up, since the upstream error text itself usually
  // asks to "wait a moment before retrying".
  const looksLikeUpstreamError = !raw || MCP_UPSTREAM_ERROR_RE.test(raw);
  if (looksLikeUpstreamError) {
    if (!_retrying) {
      await new Promise(res => setTimeout(res, 400));
      return checkDelivery(params, true);
    }
    throw new Error(`MCP delivery check failed: ${raw ? raw.slice(0, 120) : 'empty response'}`);
  }

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