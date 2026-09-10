import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The operation is not valid for the resource's current state (cancelling an
 * already-shipped order, publishing a deleted post) or the framework is
 * misconfigured (e.g. `@Roles` used with no RBAC extractor set). Code
 * `INVALID_STATE`, HTTP **409**.
 */
export class InvalidStateError extends BaseError {
  /**
   * @param message - Response message. Default `'Invalid state'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Invalid state', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.INVALID_STATE, message, {
      status: 409,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'InvalidStateError';
  }
}
