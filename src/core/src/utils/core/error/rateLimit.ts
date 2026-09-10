import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The client sent too many requests in the current window. Code
 * `RATE_LIMIT_EXCEEDED`, HTTP **429**. Thrown by the `@RateLimit` enforcer, which
 * also sets `Retry-After` and `X-RateLimit-*` headers. Rarely thrown by hand.
 *
 * Without a route-level `@Catch`, this resolves straight to a 429 response and
 * skips error handlers.
 */
export class RateLimitExceededError extends BaseError {
  /**
   * @param message - Response message. Default `'Rate limit exceeded'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Rate limit exceeded', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, {
      status: 429,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'RateLimitExceededError';
  }
}
