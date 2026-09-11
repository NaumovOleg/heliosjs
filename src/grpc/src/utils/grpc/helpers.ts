import { status } from '@grpc/grpc-js';

/**
 * Maps an arbitrary thrown value to a `{ code, message }` gRPC status pair.
 * A value that already has a numeric `code` + `message` passes through; an object
 * with an HTTP `statusCode` is translated (400→INVALID_ARGUMENT, 401→
 * UNAUTHENTICATED, 403→PERMISSION_DENIED, 404→NOT_FOUND, 409→ALREADY_EXISTS,
 * 429→RESOURCE_EXHAUSTED, 500→INTERNAL, 501→UNIMPLEMENTED, 503→UNAVAILABLE);
 * anything else becomes `INTERNAL`. Used by `GrpcServer` when a handler throws.
 *
 * @param error - The caught value.
 * @returns The gRPC status code and message to send to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Adapts an RxJS `Observable` (as returned by {@link GrpcClient} service methods)
 * to a `Promise` of its **first** emitted value; the subscription is then torn
 * down. A `Promise` passed in is returned as-is. Rejects if the source errors or
 * completes without emitting.
 *
 * @param observable - The observable (or promise) to await.
 * @returns A promise resolving with the first emitted value.
 *
 * @example
 * const user = await toPromise(userService.findById({ id: '42' }));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPromise<T>(observable: any): Promise<T> {
  if (observable instanceof Promise) {
    return observable;
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    const subscription = observable.subscribe({
      next: (value: T) => {
        if (!resolved) {
          resolved = true;
          resolve(value);
          subscription.unsubscribe();
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      },
      complete: () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Observable completed without emitting a value'));
        }
      },
    });
  });
}
