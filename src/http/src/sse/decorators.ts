import { SSE_METADATA_KEY } from '@heliosjs/core/constants';
import { createParamDecorator } from '@heliosjs/core/utils';

/**
 * Lifecycle event of a Server-Sent Events stream, one of:
 * - `'connection'` — a client opened the stream (handler receives the new client);
 * - `'close'` — a client's stream ended (disconnect, navigation, server close);
 * - `'error'` — the stream errored.
 */
export type SSEHandlerType = 'connection' | 'close' | 'error';

/**
 * Method decorator that binds a controller method to an SSE stream lifecycle
 * event. Requires SSE to be enabled on the server (`sse: { enabled: true }`).
 *
 * @param type - Which SSE event to handle: `'connection'`, `'close'`, or
 *   `'error'`. Why: one handler per phase of the stream's life.
 *
 * @example
 * @OnSSE('connection')
 * onConnect(@InjectSSE() sse: SSEService) {}
 */
export function OnSSE(type: SSEHandlerType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = Reflect.getMetadata(SSE_METADATA_KEY, target.constructor) || [];
    handlers.push({ type, method: propertyKey });
    Reflect.defineMetadata(SSE_METADATA_KEY, handlers, target.constructor);
    return descriptor;
  };
}

/**
 * Shortcut for `@OnSSE('connection')` — fires when a client opens the stream.
 *
 * @example
 * @OnSSEConnection()
 * onConnect() {}
 */
export function OnSSEConnection() {
  return OnSSE('connection');
}

/**
 * Shortcut for `@OnSSE('close')` — fires when a client's stream ends.
 *
 * @example
 * @OnSSEClose()
 * onClose() {}
 */
export function OnSSEClose() {
  return OnSSE('close');
}

/**
 * Shortcut for `@OnSSE('error')` — fires when the stream errors.
 *
 * @example
 * @OnSSEError()
 * onError() {}
 */
export function OnSSEError() {
  return OnSSE('error');
}

/**
 * Parameter decorator that injects the singleton `SSEService`, used to push
 * events to connected clients (`sendToClient`, `broadcast`) and read stream
 * stats.
 *
 * @example
 * @Get('/notify')
 * notify(@InjectSSE() sse: SSEService) {
 *   sse.broadcast({ event: 'ping', data: Date.now() });
 * }
 */
export function InjectSSE() {
  return createParamDecorator('sse');
}
