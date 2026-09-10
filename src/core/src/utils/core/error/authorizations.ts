import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The request lacks valid authentication credentials. Code `UNAUTHORIZED`,
 * HTTP **401**. Throw this when a token/session is missing, expired, or invalid
 * (use {@link ForbiddenError} when the caller *is* known but not permitted).
 *
 * Without a route-level `@Catch`, this resolves straight to a 401 response and
 * skips error handlers.
 *
 * @example
 * const token = req.getHeader('authorization');
 * if (!token) throw new UnauthorizedError('Missing bearer token');
 */
export class UnauthorizedError extends BaseError {
  /**
   * @param message - Response message. Default `'Unauthorized'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Unauthorized', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.UNAUTHORIZED, message, {
      status: 401,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'UnauthorizedError';
  }
}
