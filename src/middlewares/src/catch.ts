import type { ErrorHandler } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Registers an error handler on a controller class or a single route method. It
 * fires when a guard, pipe, middleware, handler, or interceptor throws.
 *
 * Handlers run newest-first (method-level before controller-level). The first one
 * that **returns a non-Error value** stops the chain and that value becomes the
 * response body; a handler that returns an `Error` or re-throws passes control to
 * the next handler, and if none resolves the error it propagates to the adapter's
 * default error response.
 *
 * Declaring `@Catch` also opts the route into handling the "self-resolving" error
 * codes (`FORBIDDEN`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `UNAUTHORIZED`) that
 * otherwise bypass error handlers.
 *
 * @param handler - `(error, req, res) => unknown`. `error` is the thrown value
 *   (often a `HeliosError` subclass with `.code` / `.status`). Return a value to
 *   answer the request, or return/throw an `Error` to defer. May be async. Why:
 *   map domain errors to response shapes in one place.
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Catch((err, req, res) => {
 *   if (err instanceof NotFoundError) return { error: 'not found', path: req.path };
 *   throw err; // let the framework handle everything else
 * })
 * class MyController {}
 */
export function Catch(handler: ErrorHandler) {
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ errorHandler: handler }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
