import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * A uniqueness constraint was violated (email already registered, slug taken).
 * Code `DUPLICATE_ENTRY`, HTTP **409**. Throw after catching a DB unique-violation
 * so the client gets a clean 409 instead of a 500.
 */
export class DuplicateEntryError extends BaseError {
  /**
   * @param message - Response message. Default `'Duplicate entry'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Duplicate entry', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.DUPLICATE_ENTRY, message, {
      status: 409,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'DuplicateEntryError';
  }
}
