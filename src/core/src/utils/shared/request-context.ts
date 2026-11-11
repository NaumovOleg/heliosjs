import type { Request } from '../../types/core';

/**
 * @internal Associates a raw transport response with the framework request that
 * produced it. Long-lived transports (SSE streams) need the request later, when
 * only the raw `ServerResponse` is still available.
 */
const responseRequests = new WeakMap<object, Request>();

/** @internal Binds the request to its raw transport response. */
export function bindRequestToResponse(response: object, request: Request): void {
  if (response && typeof response === 'object') {
    responseRequests.set(response, request);
  }
}

/** @internal Returns the request bound to a raw transport response, if any. */
export function getBoundRequest(response: object): Request | undefined {
  return responseRequests.get(response);
}
