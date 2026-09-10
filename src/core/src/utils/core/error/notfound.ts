import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class NotFoundError extends BaseError {
  constructor(message: string, id?: string, options?: { requestId?: string; path?: string }) {
    super(ErrorCode.NOT_FOUND, message, {
      status: 404,
      details: id ? [{ id }] : undefined,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'NotFoundError';
  }
}
