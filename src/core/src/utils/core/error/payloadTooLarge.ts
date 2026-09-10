import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * The request body exceeds the configured limit. Code `PAYLOAD_TOO_LARGE`,
 * HTTP **413**. Thrown by the body reader when `bodyLimit` (default 1 MB) is
 * passed. Throw it yourself when rejecting an oversized upload after inspection.
 */
export class PayloadTooLargeError extends BaseError {
  /**
   * @param message - Response message. Default `'Payload too large'`.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(message = 'Payload too large', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.PAYLOAD_TOO_LARGE, message, {
      status: 413,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'PayloadTooLargeError';
  }
}
