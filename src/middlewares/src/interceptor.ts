import type { InterceptorCB } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Decorator to register an interceptor at the controller or method level.
 *
 * An interceptor runs *after* the route handler. It receives the value the
 * handler returned and whatever it returns becomes the new response payload,
 * so it is the place for response shaping, wrapping, or caching.
 *
 * Signature: `(data, req, res) => newData` (may be async). Interceptors run
 * regardless of whether the handler returned a value, including `undefined`.
 *
 * @param interceptor - `(data, req, res) => newData` callback.
 *
 * @returns A decorator that attaches interceptor metadata to the target
 * (either a class or a method).
 *
 * @example
 * // Wrap every response body
 * @Intercept((data) => ({ data, timestamp: Date.now() }))
 * class MyController {}
 *
 * @example
 * // Method-level interceptor
 * class MyController {
 *   @Intercept(async (data, req) => ({ ...data, path: req.path }))
 *   getData() {}
 * }
 *
 * @remarks
 * - Interceptors replace the result returned by the handler.
 * - Multiple interceptors run in reverse order (the one nearest the handler first).
 * - Can be used for:
 *   - logging
 *   - response transformation
 *   - caching
 *   - error handling (wrapping)
 *
 * Metadata is stored using the MIDDLEWARES_CONFIG key and
 * used internally by the framework during request processing.
 */
export function Intercept(interceptor: InterceptorCB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ interceptor }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
