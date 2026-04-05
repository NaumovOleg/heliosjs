import { MiddlewareCB } from './types/core';
import { defineMiddlewaresMeta } from './utils/shared';

/**
 * Decorator to register middleware(s) at the controller or method level.
 *
 * Middlewares are functions executed before the route handler.
 * They can be used to:
 * - modify request/response
 * - perform logging
 * - handle authentication/authorization
 * - short-circuit request handling
 *
 * @param middleware - A single middleware function or an array of middleware functions.
 *
 * @returns A decorator that attaches middleware metadata to the target
 * (either a class or a method).
 *
 * @example
 * // Single middleware
 * @Use((req, res, next) => {
 *   console.log('Request received');
 *   next();
 * })
 * class MyController {}
 *
 * @example
 * // Multiple middlewares
 * @Use([
 *   authMiddleware,
 *   loggingMiddleware,
 * ])
 * class MyController {}
 *
 * @example
 * // Method-level middleware
 * class MyController {
 *   @Use(authMiddleware)
 *   getData() {}
 * }
 *
 * @remarks
 * - Middlewares are executed in the order they are defined.
 * - Can be applied at both class and method levels.
 * - Metadata is stored using the MIDDLEWARES_CONFIG key and used
 *   internally by the framework during request handling.
 */
export function Use(middleware: MiddlewareCB | MiddlewareCB[]) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];

    const data = { middlewares };

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }

    return target;
  };
}
