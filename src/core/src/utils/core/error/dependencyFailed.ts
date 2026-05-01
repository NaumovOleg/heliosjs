import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class DependencyFailedError extends BaseError {
  constructor(message = 'Dependency failed', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.DEPENDENCY_FAILED, message, {
      status: 424,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'DependencyFailedError';
  }
}
