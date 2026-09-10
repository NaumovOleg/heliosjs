import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The service is temporarily unable to handle the request (maintenance, overload,
 * a hard dependency being down). Code `SERVICE_UNAVAILABLE`, HTTP **503**. Throw
 * from a health gate or circuit breaker.
 */
export class ServiceUnavailableError extends BaseError {
  /**
   * @param message - Response message. Default `'Service unavailable'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Service unavailable', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, {
      status: 503,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'ServiceUnavailableError';
  }
}
