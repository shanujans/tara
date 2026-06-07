interface CacheEntry<T> { data: T; ts: number; }
const store = new Map<string, CacheEntry<unknown>>();
const TTL = 5 * 60 * 1000;

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { store.delete(key); return null; }
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T) {
  store.set(key, { data, ts: Date.now() });
}