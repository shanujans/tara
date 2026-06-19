/**
 * lib/cache.ts — In-memory MCP response cache.
 * 
 * Dulith explicitly asked developers to cache data to manage Kapruka's rate limits.
 * Different TTLs per data type — search results expire faster than stable data like categories.
 * Note: per-instance on Vercel serverless (resets on cold start) but still highly effective
 * for repeated calls within the same warm function pool.
 */

interface CacheEntry<T> { data: T; ts: number; ttl: number; }
const store = new Map<string, CacheEntry<unknown>>();

// Default TTLs in milliseconds
export const TTL = {
  SEARCH:   5  * 60 * 1000,  //  5 min — search results (products can change)
  PRODUCT:  30 * 60 * 1000,  // 30 min — product details (stable)
  CITIES:   60 * 60 * 1000,  // 60 min — delivery cities (rarely changes)
  DELIVERY: 10 * 60 * 1000,  // 10 min — delivery check (date-specific)
  CATEGORY: 60 * 60 * 1000,  // 60 min — category list (very stable)
};

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) { store.delete(key); return null; }
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T, ttl = TTL.SEARCH): void {
  store.set(key, { data, ts: Date.now(), ttl });
}

export function cacheKey(...parts: (string | number | boolean | undefined)[]): string {
  return parts.filter(Boolean).join('::');
}

// Stats for debugging — visible in Vercel logs
export function cacheStats(): string {
  return `[cache] ${store.size} entries`;
}
