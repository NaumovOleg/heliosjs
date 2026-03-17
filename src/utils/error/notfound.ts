import { ErrorCode } from '@types';
import { BaseError } from './base';

export class NotFoundError extends BaseError {
  constructor(resource: string, id: string, options?: { requestId?: string; path?: string }) {
    super(ErrorCode.NOT_FOUND, `${resource} with id ${id} not found`, {
      status: 404,
      details: [{ resource, id }],
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'NotFoundError';
  }
}
