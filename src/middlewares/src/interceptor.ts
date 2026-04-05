import { InterceptorCB } from '@heliosjs/core';
import { defineMiddlewaresMeta } from './utils/shared';
/**
 * Decorator to register an interceptor at the controller or method level.
 *
 * Interceptors are functions that wrap the execution of a route handler.
 * They can run logic before after the handler is executed, allowing
 * you to modify  responses, or handle cross-cutting concerns.
 *
 * @param handler - Interceptor callback function.
 *
 * @returns A decorator that attaches interceptor metadata to the target
 * (either a class or a method).
 *
 * @example
 * // Logging interceptor
 * @Intercept(async (ctx, next) => {
 *   console.log('Before');
 *   const result = await next();
 *   console.log('After');
 *   return result;
 * })
 * class MyController {}
 *
 * @example
 * // Method-level interceptor
 * class MyController {
 *   @Intercept(async (ctx, next) => {
 *     return next();
 *   })
 *   getData() {}
 * }
 *
 * @remarks
 * - Interceptors can modify the result returned by the handler.
 * - They are executed in the order they are applied.
 * - Can be used for:
 *   - logging
 *   - response transformation
 *   - caching
 *   - error handling (wrapping)
 *
 * Metadata is stored using the MIDDLEWARES_CONFIG key and
 * used internally by the framework during request processing.
 */
export function Intercept(handler: InterceptorCB) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = { interceptors: [handler] };

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
