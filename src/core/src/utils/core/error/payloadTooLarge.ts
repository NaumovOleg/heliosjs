import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class PayloadTooLargeError extends BaseError {
  constructor(message = 'Payload too large', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.PAYLOAD_TOO_LARGE, message, {
      status: 413,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'PayloadTooLargeError';
  }
}
