import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class InternalServerError extends BaseError {
  constructor(resource: string, id: string, options?: { requestId?: string; path?: string }) {
    super(ErrorCode.INTERNAL_SERVER_ERROR, resource, {
      status: 500,
      details: [{ resource, id }],
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'NotFoundError';
  }
}
