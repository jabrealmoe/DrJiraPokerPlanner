/**
 * Simple in-memory cache service
 * Scoped to the lambda execution environment.
 * Note: Lambda instances are reused, so this cache persists across invocations
 * until the instance is recycled (cold start).
 */

class CacheService {
  constructor(defaultTtl = 5000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtl;
    // Periodic cleanup every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  set(key, value, ttl = this.defaultTtl) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
    return value;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  invalidatePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global instance (singleton pattern for lambda reuse)
// We use a global variable attached to 'global' to ensure it survives 
// even if module is re-evaluated (though in Lambda module scope is usually persistent)
const GLOBAL_CACHE_KEY = Symbol.for('poker_app.GlobalCache');

if (!global[GLOBAL_CACHE_KEY]) {
  global[GLOBAL_CACHE_KEY] = new CacheService();
}

/**
 * Get the global cache instance
 * @param {number} defaultTtl - Default TTL in ms
 * @returns {CacheService}
 */
export const getGlobalCache = (defaultTtl) => {
  const cache = global[GLOBAL_CACHE_KEY];
  if (defaultTtl) cache.defaultTtl = defaultTtl;
  return cache;
};
