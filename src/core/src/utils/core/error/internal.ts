import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * An unexpected server-side failure. Code `INTERNAL_SERVER_ERROR`, HTTP **500**.
 * Any uncaught non-Helios error already normalizes to a 500 response, so throw
 * this explicitly only when you want a specific message and structured
 * `resource`/`id` detail.
 *
 * @example
 * throw new InternalServerError('payment-gateway', txnId);
 */
export class InternalServerError extends BaseError {
  /**
   * @param resource - Short label for what failed; used as the message and stored
   *   in `details` as `{ resource }`.
   * @param id - Optional identifier related to the failure; when given, stored as
   *   `details: [{ resource, id }]`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(resource: string, id?: string, options?: { requestId?: string; path?: string }) {
    super(ErrorCode.INTERNAL_SERVER_ERROR, resource, {
      status: 500,
      details: id ? [{ resource, id }] : [{ resource }],
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'InternalServerError';
  }
}
