import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.FORBIDDEN, message, {
      status: 403,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'ForbiddenError';
  }
}
