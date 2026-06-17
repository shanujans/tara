/**
 * lib/mcp.ts
 *
 * Kapruka MCP client — Streamable HTTP transport.
 * Endpoint : https://mcp.kapruka.com/mcp
 * Auth     : none (public free tier)
 * Rate     : 60 req/min, 30 orders/hr per IP
 *
 * Tool names exactly as documented at https://mcp.kapruka.com
 */

const MCP_ENDPOINT = 'https://mcp.kapruka.com/mcp';

let _requestId = 1;

// ── Core JSON-RPC caller ─────────────────────────────────────────────────────

async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const body = {
    jsonrpc: '2.0',
    method:  'tools/call',
    params:  { name: toolName, arguments: args },
    id:      _requestId++,
  };

  const res = await fetch(MCP_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MCP ${toolName} HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(`MCP ${toolName} error: ${JSON.stringify(json.error)}`);
  }

  // MCP wraps result in content[0].text as a JSON string
  const raw = json.result?.content?.[0]?.text;
  if (raw) {
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  }
  return json.result as T;
}

// ── Tool wrappers (exact names from mcp.kapruka.com) ────────────────────────

export const mcp = {
  /**
   * Search the Kapruka catalogue.
   * q, category, min_price, max_price, in_stock_only, sort, limit, cursor, currency
   */
  searchProducts: (args: {
    q:             string;
    category?:     string;
    min_price?:    number;
    max_price?:    number;
    in_stock_only?: boolean;
    sort?:         'relevance' | 'price_asc' | 'price_desc' | 'newest';
    limit?:        number;
    cursor?:       string;
    currency?:     string;
  }) => callTool('kapruka_search_products', args as Record<string, unknown>),

  /**
   * Full product details by ID — name, price, stock, variants, images, shipping URL.
   */
  getProduct: (productId: string, currency?: string) =>
    callTool('kapruka_get_product', { product_id: productId, ...(currency ? { currency } : {}) }),

  /**
   * Top-level category names with browse URLs.
   */
  listCategories: (depth?: number) =>
    callTool('kapruka_list_categories', depth ? { depth } : {}),

  /**
   * Search Sri Lanka delivery cities by name or vernacular alias.
   */
  listDeliveryCities: (query: string, limit = 10) =>
    callTool('kapruka_list_delivery_cities', { query, limit }),

  /**
   * Check delivery availability + flat LKR rate for a city/date/product.
   * Returns perishable warning for cakes/flowers.
   */
  checkDelivery: (args: {
    city:          string;
    delivery_date: string;   // YYYY-MM-DD
    product_id?:   string;
  }) => callTool('kapruka_check_delivery', args as Record<string, unknown>),

  /**
   * Create a guest-checkout order.
   * Returns a click-to-pay URL valid for 60 minutes.
   * No Kapruka account required.
   *
   * cart     : [{ product_id, quantity, variant? }]
   * recipient: { name, phone, address, city }
   * delivery : { date }
   * sender   : { name, phone }        (optional)
   * gift_message: string              (optional)
   * currency : 'LKR' | 'USD' | ...   (optional, default LKR)
   */
  createOrder: (args: {
    cart:          { product_id: string; quantity: number; variant?: string }[];
    recipient:     { name: string; phone: string; address: string; city: string };
    delivery:      { date: string };
    sender?:       { name: string; phone: string };
    gift_message?: string;
    currency?:     string;
  }) => callTool('kapruka_create_order', args as Record<string, unknown>),

  /**
   * Track an existing order by order number.
   */
  trackOrder: (orderNumber: string) =>
    callTool('kapruka_track_order', { order_number: orderNumber }),
};
