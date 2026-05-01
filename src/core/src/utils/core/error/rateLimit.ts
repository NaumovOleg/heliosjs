import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class RateLimitExceededError extends BaseError {
  constructor(message = 'Rate limit exceeded', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, {
      status: 429,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'RateLimitExceededError';
  }
}
