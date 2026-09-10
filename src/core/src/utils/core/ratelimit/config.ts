import type { RateLimitConfig } from '../../../types/core/ratelimit';

let config: RateLimitConfig | undefined;

/**
 * Sets the process-wide default `strategy` / `keyGen` / `onLimit` used by every
 * `@RateLimit` decorator that does not specify its own. `max` and `windowMs`
 * always come from the decorator and cannot be defaulted here.
 *
 * @param cfg - {@link RateLimitConfig}:
 *   - `strategy` — default limiting algorithm (`fixedWindow()`, `slidingWindow()`,
 *     `tokenBucket()`). Pass a Redis-backed store here to make every limiter
 *     distributed. Falls back to a shared in-memory fixed window.
 *   - `keyGen` — `(req) => string` default bucket key. Falls back to the request
 *     fingerprint.
 *   - `onLimit` — `(req, res) => void | Promise<void>` default breach hook.
 *   Pass `undefined` to clear. Why: configure the backend once instead of on
 *   every decorator.
 */
export function setRateLimitConfig(cfg: RateLimitConfig | undefined): void {
  config = cfg;
}

/**
 * Returns the current global rate-limit defaults, or `undefined` if unset. Used
 * internally by the `@RateLimit` enforcer.
 */
export function getRateLimitConfig(): RateLimitConfig | undefined {
  return config;
}
