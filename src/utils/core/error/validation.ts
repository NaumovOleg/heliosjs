import { ErrorCode, ErrorDetails, IValidationError } from '../../../types/core/error';
import { BaseError } from './base';

export class ValidationError extends BaseError implements IValidationError {
  public readonly code = ErrorCode.VALIDATION_FAILED;
  public readonly status = 400;

  constructor(details: ErrorDetails[], options?: { requestId?: string; path?: string }) {
    super(ErrorCode.VALIDATION_FAILED, 'Validation failed', {
      status: 400,
      details,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'ValidationError';
  }
}
