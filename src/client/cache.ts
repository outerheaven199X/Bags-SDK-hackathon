/** Tiered TTL cache to stay within the 1,000 req/hr Bags API rate limit. */

export const CACHE_TTL = {
  /** Social-to-wallet resolution — never changes once created. */
  immutable: Infinity,
  /** Creators, pool configs, partner configs — rarely change. */
  stable: 10 * 60 * 1000,
  /** Lifetime fees, claim stats, token feed, pools — moderate churn. */
  moderate: 5 * 60 * 1000,
  /** Claimable positions — changes on every trade. */
  volatile: 2 * 60 * 1000,
  /** Quotes, transactions, auth, send-tx — never cache. */
  none: 0,
} as const;

interface CacheEntry {
  data: unknown;
  expires: number;
}

class ApiCache {
  private store = new Map<string, CacheEntry>();

  /**
   * Retrieve a cached value if it exists and hasn't expired.
   * @param key - Cache key (typically "domain:identifier").
   * @returns The cached value or null if missing/expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires && entry.expires !== Infinity) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Store a value with a TTL. Zero-TTL values are never stored.
   * @param key - Cache key.
   * @param data - Value to cache.
   * @param ttlMs - Time-to-live in ms, or Infinity for permanent caching.
   */
  set(key: string, data: unknown, ttlMs: number): void {
    if (ttlMs === 0) return;
    const expires = ttlMs === Infinity ? Infinity : Date.now() + ttlMs;
    this.store.set(key, { data, expires });
  }

  /**
   * Remove all cache entries whose key starts with the given prefix.
   * @param prefix - Key prefix to match for invalidation.
   */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Return current number of cached entries (for diagnostics). */
  get size(): number {
    return this.store.size;
  }
}

export const cache = new ApiCache();
