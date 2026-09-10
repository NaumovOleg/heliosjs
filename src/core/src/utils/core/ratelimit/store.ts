import type { RateLimitState, RateLimitStore } from '../../../types/core/ratelimit';

interface Entry {
  state: RateLimitState;
  expireAt: number;
}

/**
 * In-memory, single-process rate-limit store. Entries are evicted lazily on
 * access once their TTL has elapsed — no background timer, so it never keeps
 * the process alive. Not distributed; swap for a Redis-backed store across
 * multiple instances.
 *
 * ponytail: hard cap + drop-oldest-written on overflow. Bounds memory under a
 * large/hostile key space (many IPs/fingerprints that are never revisited).
 * A Redis store gets native TTL/LRU — use it if the key space is big or shared.
 */
export class MemoryStore implements RateLimitStore {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly maxEntries = 10_000) {}

  async get(key: string): Promise<RateLimitState | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expireAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return { ...entry.state };
  }

  async set(key: string, state: RateLimitState, ttlMs: number): Promise<void> {
    // Re-insert so recency = insertion order; evict the oldest on overflow.
    this.map.delete(key);
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { state: { ...state }, expireAt: Date.now() + ttlMs });
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }
}
