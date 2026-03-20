import { SSE_METADATA_KEY } from '../constants';
import { createParamDecorator } from '../utils/core';

export type SSEHandlerType = 'connection' | 'close' | 'error';

/**
 * Method decorator to handle specific SSE events.
 *
 * @param {SSEHandlerType} type - The type of SSE event to handle ('connection', 'close', 'error').
 *
 * Usage:
 * ```ts
 * @OnSSE('connection')
 * onConnect() {}
 * ```
 */
export function OnSSE(type: SSEHandlerType) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = Reflect.getMetadata(SSE_METADATA_KEY, target.constructor) || [];
    handlers.push({ type, method: propertyKey });
    Reflect.defineMetadata(SSE_METADATA_KEY, handlers, target.constructor);
    return descriptor;
  };
}

/**
 * Method decorator to handle SSE connection events.
 *
 * Usage:
 * ```ts
 * @OnSSEConnection()
 * onConnect() {}
 * ```
 */
export function OnSSEConnection() {
  return OnSSE('connection');
}

/**
 * Method decorator to handle SSE close events.
 *
 * Usage:
 * ```ts
 * @OnSSEClose()
 * onClose() {}
 * ```
 */
export function OnSSEClose() {
  return OnSSE('close');
}

/**
 * Method decorator to handle SSE error events.
 *
 * Usage:
 * ```ts
 * @OnSSEError()
 * onError() {}
 * ```
 */
export function OnSSEError() {
  return OnSSE('error');
}

/**
 * Parameter decorator to inject the SSE instance.
 *
 * Usage:
 * ```ts
 * someMethod(@InjectSSE() sse) {}
 * ```
 */
export function InjectSSE() {
  return createParamDecorator('sse');
}
