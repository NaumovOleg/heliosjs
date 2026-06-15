import type { Request } from './request';
import type { Response } from './response';

/** Result of a single rate-limit check. */
export interface RateLimitRecord {
  /** Hits used in the current window (or tokens consumed). */
  totalHits: number;
  /** max - used, clamped to >= 0. */
  remaining: number;
  /** Epoch ms when the limit next eases (window end / refill). */
  resetAt: number;
  /** Whether THIS request is permitted. */
  allowed: boolean;
}

/**
 * Generic numeric state for one key. Meaning is strategy-defined:
 * fixed/sliding window -> count = hits used; token bucket -> count = tokens
 * left (fractional); resetAt -> window end OR last-refill timestamp (epoch ms).
 */
export interface RateLimitState {
  count: number;
  resetAt: number;
}

/** Low-level pluggable backend: a generic per-key state store with TTL eviction. */
export interface RateLimitStore {
  get(key: string): Promise<RateLimitState | undefined>;
  set(key: string, state: RateLimitState, ttlMs: number): Promise<void>;
  reset(key: string): Promise<void>;
}

/** Per-request inputs handed to a strategy. */
export interface RateLimitContext {
  request: Request;
  max: number;
  windowMs: number;
  cost: number;
}

/** High-level extension point: owns the limiting algorithm. */
export interface RateLimitStrategy {
  consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord>;
}

/** Options accepted by the `@RateLimit` decorator. */
export interface RateLimitOptions {
  max: number;
  windowMs: number;
  strategy?: RateLimitStrategy;
  keyGen?: (req: Request) => string;
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
  cost?: number;
}

/** Global defaults (max/windowMs always come from the decorator). */
export interface RateLimitConfig {
  strategy?: RateLimitStrategy;
  keyGen?: (req: Request) => string;
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
}
