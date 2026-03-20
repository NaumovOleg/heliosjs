import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class InvalidStateError extends BaseError {
  constructor(message = 'Invalid state', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.INVALID_STATE, message, {
      status: 409,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'InvalidStateError';
  }
}
