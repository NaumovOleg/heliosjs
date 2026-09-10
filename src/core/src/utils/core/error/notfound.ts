import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * A requested resource does not exist. Code `NOT_FOUND`, HTTP **404**. Thrown by
 * the router when no route matches; throw it yourself when a lookup by id returns
 * nothing.
 *
 * Without a route-level `@Catch`, this resolves straight to a 404 response and
 * skips error handlers.
 *
 * @example
 * const user = await repo.findById(id);
 * if (!user) throw new NotFoundError('User', id);
 */
export class NotFoundError extends BaseError {
  /**
   * @param message - What was not found (e.g. `'User'`) or a full sentence.
   * @param id - Optional identifier that was looked up; when given it is attached
   *   as `details: [{ id }]`. Why: lets the client show which id failed.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message: string, id?: string, options?: { requestId?: string; path?: string }) {
    super(ErrorCode.NOT_FOUND, message, {
      status: 404,
      details: id ? [{ id }] : undefined,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'NotFoundError';
  }
}
