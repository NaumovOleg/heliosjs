import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class DuplicateEntryError extends BaseError {
  constructor(message = 'Duplicate entry', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.DUPLICATE_ENTRY, message, {
      status: 409,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'DuplicateEntryError';
  }
}
