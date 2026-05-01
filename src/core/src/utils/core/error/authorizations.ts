import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.UNAUTHORIZED, message, {
      status: 401,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'UnauthorizedError';
  }
}
