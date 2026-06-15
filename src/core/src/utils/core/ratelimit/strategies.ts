import type {
  RateLimitContext,
  RateLimitRecord,
  RateLimitStore,
  RateLimitStrategy,
} from '../../../types/core/ratelimit';
import { MemoryStore } from './store';

/**
 * Fixed-window counter. One key per limit; the counter resets hard at the end
 * of each `windowMs` window.
 */
export function fixedWindow(store: RateLimitStore = new MemoryStore()): RateLimitStrategy {
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      let state = await store.get(key);
      if (!state || state.resetAt <= now) {
        state = { count: 0, resetAt: now + ctx.windowMs };
      }
      state.count += ctx.cost;
      await store.set(key, state, state.resetAt - now);

      const remaining = Math.max(0, ctx.max - state.count);
      return {
        totalHits: state.count,
        remaining,
        resetAt: state.resetAt,
        allowed: state.count <= ctx.max,
      };
    },
  };
}

/**
 * Sliding-window counter approximated from two adjacent fixed windows. The
 * previous window's count is weighted by the fraction of it still inside the
 * sliding view, smoothing the boundary bursts a fixed window allows. Uses two
 * time-bucketed sub-keys (`<key>:<windowStart>`).
 */
export function slidingWindow(store: RateLimitStore = new MemoryStore()): RateLimitStrategy {
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      const windowMs = ctx.windowMs;
      const currStart = Math.floor(now / windowMs) * windowMs;
      const prevStart = currStart - windowMs;
      const currKey = `${key}:${currStart}`;
      const prevKey = `${key}:${prevStart}`;

      const curr = (await store.get(currKey)) ?? { count: 0, resetAt: currStart + windowMs };
      const prev = (await store.get(prevKey)) ?? { count: 0, resetAt: prevStart + windowMs };

      curr.count += ctx.cost;
      // Keep current long enough to act as "previous" during the next window.
      await store.set(currKey, curr, windowMs * 2);

      // Drop the window that has fully left the sliding view (two windows back)
      // so the store does not accumulate dead sub-keys (lazy eviction never
      // re-reads them).
      const staleStart = currStart - windowMs * 2;
      await store.reset(`${key}:${staleStart}`);

      const elapsed = now - currStart;
      const prevWeight = (windowMs - elapsed) / windowMs;
      const estimated = prev.count * prevWeight + curr.count;

      const remaining = Math.max(0, Math.floor(ctx.max - estimated));
      return {
        totalHits: Math.ceil(estimated),
        remaining,
        resetAt: currStart + windowMs,
        allowed: estimated <= ctx.max,
      };
    },
  };
}

export interface TokenBucketOptions {
  /** Tokens added per second. */
  refillRate: number;
}

/**
 * Token bucket: `max` is the bucket capacity, `refillRate` tokens are added per
 * second up to capacity. Permits bursts up to capacity. `state.count` holds the
 * (fractional) tokens available; `state.resetAt` holds the last-refill timestamp.
 */
export function tokenBucket(
  options: TokenBucketOptions,
  store: RateLimitStore = new MemoryStore(),
): RateLimitStrategy {
  const { refillRate } = options;
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      const capacity = ctx.max;
      const cost = ctx.cost;

      let state = await store.get(key);
      if (!state) {
        state = { count: capacity, resetAt: now };
      }
      // Refill based on elapsed time since the last refill.
      const elapsedSec = (now - state.resetAt) / 1000;
      state.count = Math.min(capacity, state.count + elapsedSec * refillRate);
      state.resetAt = now;

      const allowed = state.count >= cost;
      if (allowed) {
        state.count -= cost;
      }

      // TTL: long enough for the bucket to fully refill.
      const ttlMs = Math.ceil((capacity / refillRate) * 1000);
      await store.set(key, state, ttlMs);

      // resetAt header value: when the limit next eases.
      const deficit = allowed
        ? capacity - state.count // time to refill to full
        : cost - state.count; // time until this request could succeed
      const easeMs = deficit > 0 ? Math.ceil((deficit / refillRate) * 1000) : 0;

      return {
        totalHits: capacity - Math.floor(state.count),
        remaining: Math.floor(state.count),
        resetAt: now + easeMs,
        allowed,
      };
    },
  };
}

let defaultStrategy: RateLimitStrategy | undefined;

/**
 * Lazily-created shared default strategy: a fixed window over a single
 * process-wide MemoryStore. Used when no strategy is configured anywhere.
 */
export function getDefaultStrategy(): RateLimitStrategy {
  if (!defaultStrategy) {
    defaultStrategy = fixedWindow(new MemoryStore());
  }
  return defaultStrategy;
}
