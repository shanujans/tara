// Simple in-memory rate limiter (per serverless instance)
const hits = new Map<string, { count: number; ts: number }>();

export function rateLimit(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.ts > windowMs) {
    hits.set(ip, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function sanitizeInput(text: string): string {
  return text
    .slice(0, 2000)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bignore\s+(previous|all|above)\s+instructions?\b/gi, '[blocked]')
    .replace(/\bsystem\s*(prompt|override|role)\b/gi, '[blocked]')
    .replace(/\byou\s+are\s+now\b/gi, '[blocked]')
    .replace(/```[\s\S]*?```/g, '')
    .trim();
}

export function sanitizeProduct(p: Record<string, unknown>) {
  // price can be a plain number OR { amount: N }
  const rawPrice = typeof p.price === 'object'
    ? ((p.price as Record<string, unknown>)?.amount ?? 0)
    : (p.price ?? 0);

  return {
    id:    String(p.id ?? '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80),
    name:  String(p.name ?? '').replace(/<[^>]*>/g, '').slice(0, 200),
    price: Math.max(0, Number(rawPrice) || 0),
    image: (() => {
      const u = String(p.image_url ?? p.image ?? p.thumbnail ?? p.photo ?? '');
      return u.startsWith('http') ? u : '';
    })(),
    url: (() => {
      const rawUrl = String(p.url ?? p.link ?? p.product_url ?? '');
      // Reject image URLs — never use them as product page links
      if (/\.(jpg|jpeg|png|webp|gif|svg)/i.test(rawUrl)) {
        const id = String(p.id ?? '');
        return id ? `https://www.kapruka.com/p/${id}` : '';
      }
      if (rawUrl.startsWith('http')) return rawUrl;
      if (rawUrl.startsWith('/')) return `https://www.kapruka.com${rawUrl}`;
      const id = String(p.id ?? '');
      return id ? `https://www.kapruka.com/p/${id}` : '';
    })(),
    // pass summary through so modal can use it as description
    summary: String(p.summary ?? p.description ?? '').replace(/<[^>]*>/g, '').slice(0, 400),
    category: String(p.category ?? ''),
    in_stock:  Boolean(p.in_stock),
    stock_level: String(p.stock_level ?? ''),
  };
}

export function validateCheckout(body: Record<string, unknown>): string | null {
  const { items, district, deliveryDate, recipient } = body as {
    items?: unknown[];
    district?: string;
    deliveryDate?: string;
    recipient?: { name?: string; phone?: string };
  };
  if (!items?.length) return 'Empty cart';
  if ((items as unknown[]).length > 30) return 'Too many items';
  if (!district) return 'Select district';
  if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return 'Invalid date';
  if (!recipient?.name?.trim()) return 'Recipient name required';
  if (!recipient?.phone?.trim()) return 'Recipient phone required';
  if (!/^(\+94|0)\d{9}$/.test(recipient.phone.replace(/\s/g, ''))) return 'Invalid phone number';
  const d = new Date(deliveryDate);
  if (isNaN(d.getTime()) || d < new Date()) return 'Delivery date must be future';
  return null;
}