import { status } from '@grpc/grpc-js';

export function normalizeError(error: any): { code: number; message: string } {
  if (error.code && typeof error.code === 'number' && error.message) {
    return { code: error.code, message: error.message };
  }

  if (error.statusCode) {
    return {
      code: mapHttpStatusToGrpc(error.statusCode),
      message: error.message,
    };
  }

  return {
    code: status.INTERNAL,
    message: error.message || 'Internal server error',
  };
}

function mapHttpStatusToGrpc(httpStatus: number): number {
  const mapping: Record<number, number> = {
    400: status.INVALID_ARGUMENT,
    401: status.UNAUTHENTICATED,
    403: status.PERMISSION_DENIED,
    404: status.NOT_FOUND,
    409: status.ALREADY_EXISTS,
    429: status.RESOURCE_EXHAUSTED,
    500: status.INTERNAL,
    501: status.UNIMPLEMENTED,
    503: status.UNAVAILABLE,
  };

  return mapping[httpStatus] || status.INTERNAL;
}

export function toPromise<T>(observable: any): Promise<T> {
  if (observable instanceof Promise) {
    return observable;
  }

  return new Promise((resolve, reject) => {
    const subscription = observable.subscribe({
      next: (value: T) => {
        resolve(value);
        subscription.unsubscribe();
      },
      error: reject,
    });
  });
}
