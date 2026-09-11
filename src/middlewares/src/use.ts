import type { MiddlewareCB } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';

/**
 * Registers one or more middlewares on a controller class or a single route
 * method. Middlewares run before the handler, in declaration order, after guards
 * and pipes in the request pipeline. Calling `next(err)` with an error aborts the
 * request; not calling `next` still proceeds (the pipeline advances once the
 * middleware resolves).
 *
 * Applied to a class, the middleware covers every route in it (and its child
 * controllers); applied to a method, only that route.
 *
 * @param middleware - A middleware callback `(req, res, next) => void | Promise<void>`,
 *   or an array of them applied in order. Why: attach auth, logging, request
 *   shaping, or short-circuit logic without hand-wiring it into each handler.
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Use([authMiddleware, loggingMiddleware])
 * class MyController {
 *   @Use(rateLimitMiddleware)
 *   getData() {}
 * }
 */
export function Use(middleware: MiddlewareCB | MiddlewareCB[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];

    const data = middlewares.map((middleware) => ({ middleware }));

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }

    return target;
  };
}
