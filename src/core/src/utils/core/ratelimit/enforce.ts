import type { Request, Response, Route } from '../../../types/core';
import type { RateLimitOptions, RateLimitStrategy } from '../../../types/core/ratelimit';
import { RateLimitExceededError } from '../error';
import { getOrComputeFingerprint } from '../fingerprint';
import { getRateLimitConfig } from './config';
import { getDefaultStrategy } from './strategies';

/**
 * Resolve and apply rate limiting for a route. Collects all `rateLimit`
 * metadata items (controller-level precede method-level in `route.functions`,
 * so the last one wins), merges strategy/keyGen/onLimit over the global config,
 * runs the strategy, sets `X-RateLimit-*` headers, and throws on breach.
 */
export async function enforceRateLimit(
  request: Request,
  response: Response,
  route: Route,
): Promise<void> {
  const items = route.functions
    .map((fn) => fn.rateLimit)
    .filter((item): item is RateLimitOptions => Boolean(item));

  if (items.length === 0) return;

  const globalConfig = getRateLimitConfig();
  let strategy: RateLimitStrategy | undefined = globalConfig?.strategy;
  let keyGen = globalConfig?.keyGen;
  let onLimit = globalConfig?.onLimit;
  let max = 0;
  let windowMs = 0;
  let cost = 1;

  for (const item of items) {
    // max/windowMs are required on every item, so the last item always wins;
    // cost/strategy/keyGen/onLimit only override when the item defines them.
    max = item.max;
    windowMs = item.windowMs;
    cost = item.cost ?? cost;
    if (item.strategy) strategy = item.strategy;
    if (item.keyGen) keyGen = item.keyGen;
    if (item.onLimit) onLimit = item.onLimit;
  }

  const effectiveStrategy = strategy ?? getDefaultStrategy();
  const effectiveKeyGen = keyGen ?? ((req: Request) => getOrComputeFingerprint(req));

  const key = `${route.method} ${route.route}:${effectiveKeyGen(request)}`;
  const record = await effectiveStrategy.consume(key, { request, max, windowMs, cost });

  response.setHeaders({
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(record.remaining),
    'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
  });

  if (!record.allowed) {
    const retryAfter = Math.max(0, Math.ceil((record.resetAt - Date.now()) / 1000));
    response.setHeader('Retry-After', String(retryAfter));
    if (onLimit) {
      // A failure in the user hook must not mask the rate-limit result.
      try {
        await onLimit(request, response);
      } catch {
        // swallow: the 429 below is the authoritative outcome
      }
    }
    throw new RateLimitExceededError('Rate limit exceeded', { path: request.path });
  }
}
