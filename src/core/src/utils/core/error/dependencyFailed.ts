import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * A downstream call this request depends on failed, so the request cannot
 * proceed. Code `DEPENDENCY_FAILED`, HTTP **424** (Failed Dependency). Throw when
 * an upstream service returns an error you cannot recover from; put its payload
 * in `BaseError`'s `upstream` option if useful.
 */
export class DependencyFailedError extends BaseError {
  /**
   * @param message - Response message. Default `'Dependency failed'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Dependency failed', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.DEPENDENCY_FAILED, message, {
      status: 424,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'DependencyFailedError';
  }
}
