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

// Strip prompt injection patterns from user input
export function sanitizeInput(text: string): string {
  return text
    .slice(0, 2000) // max length
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bignore\s+(previous|all|above)\s+instructions?\b/gi, '[blocked]')
    .replace(/\bsystem\s*(prompt|override|role)\b/gi, '[blocked]')
    .replace(/\byou\s+are\s+now\b/gi, '[blocked]')
    .replace(/```[\s\S]*?```/g, '') // strip code blocks used for injection
    .trim();
}

// Sanitize product data from MCP before rendering
export function sanitizeProduct(p: Record<string, unknown>) {
  return {
    id: String(p.id ?? '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80),
    name: String(p.name ?? '').replace(/<[^>]*>/g, '').slice(0, 200),
    price: Math.max(0, Number((p.price as Record<string, unknown>)?.amount ?? p.price ?? 0)),
    image: (() => {
      const url = String(p.image_url ?? p.image ?? '');
      return url.startsWith('http') ? url : '';
    })(),
    url: (() => {
      const url = String(p.url ?? '');
      return url.startsWith('https://www.kapruka.com') ? url : '';
    })(),
  };
}

// Validate checkout inputs
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