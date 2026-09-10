import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The caller is authenticated but not allowed to perform this action.
 * Code `FORBIDDEN`, HTTP **403**. Thrown automatically when a guard or `@Roles`
 * check fails; throw it yourself for ownership / permission checks inside a
 * handler.
 *
 * Without a route-level `@Catch`, this resolves straight to a 403 response and
 * skips error handlers.
 *
 * @example
 * if (doc.ownerId !== req.getState('userId')) {
 *   throw new ForbiddenError('You do not own this document');
 * }
 */
export class ForbiddenError extends BaseError {
  /**
   * @param message - Response message. Default `'Forbidden'`.
   * @param options - Optional `{ requestId, path }` request context (normally
   *   set by the framework).
   */
  constructor(message = 'Forbidden', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.FORBIDDEN, message, {
      status: 403,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'ForbiddenError';
  }
}
