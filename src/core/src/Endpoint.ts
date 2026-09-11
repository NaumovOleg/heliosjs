import type { MiddlewareCB } from './types/core';
import { HTTP_METHODS } from './types/core';
import { getGlobalLogger } from './utils/core/logger';
import { defineRouteMeta } from './utils/shared';

/**
 * Method decorator that binds a controller method to an HTTP endpoint. Prefer the
 * verb shortcuts ({@link Get}, {@link Post}, …) — use `Endpoint` directly only
 * when the method is dynamic.
 *
 * @param method - Member of the `HTTP_METHODS` enum, one of: `GET`, `POST`,
 *   `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`, `QUERY` (body-carrying read), or
 *   `ANY` (matches every method). The value is upper-cased before use. Why: this
 *   is the method the router matches the incoming request against.
 * @param pathPattern - Route pattern relative to the controller prefix, defaults
 *   to `'/'`. Supports static segments, `:param`, `:param(regex)`, optional
 *   `:param?`, and trailing `*` wildcard. Why: defines which paths reach this
 *   handler and what `@Params()` can extract.
 * @param middlewares - Middlewares run before this route's handler, in array
 *   order, ahead of any method-level `@Use`/guard decorators. Why: per-route
 *   pre-processing without a separate decorator.
 *
 * @returns A method decorator.
 */
export function Endpoint(method: HTTP_METHODS, pathPattern?: string, middlewares?: MiddlewareCB[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = target[propertyKey];
    if (!originalMethod) {
      getGlobalLogger().warn(`@Endpoint on a missing method (${method} ${pathPattern ?? '/'})`);
      return descriptor;
    }

    const data = {
      route: pathPattern ?? '/',
      middlewares: middlewares ?? [],
      method: method.toUpperCase() as HTTP_METHODS,
    };

    defineRouteMeta(data, target, propertyKey);

    return descriptor;
  };
}

/**
 * Shortcut decorator for HTTP GET method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for GET endpoint.
 */
export const Get = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.GET, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP POST method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for POST endpoint.
 */
export const Post = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.POST, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP PUT method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for PUT endpoint.
 */
export const Put = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.PUT, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP PATCH method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for PATCH endpoint.
 */
export const Patch = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.PATCH, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP DELETE method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for DELETE endpoint.
 */
export const Delete = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.DELETE, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP OPTIONS method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for OPTIONS endpoint.
 */
export const Options = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.OPTIONS, pathPattern, middlewares);
};
/**
 * Shortcut decorator for HTTP HEAD method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for HEAD endpoint.
 */
export const Head = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.HEAD, pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP QUERY method.
 *
 * QUERY is a safe, idempotent method that carries a request body, so the
 * request payload is read from the body rather than the URL query string.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for QUERY endpoint.
 *
 * @example
 * @Query('/search')
 * search(@Body() filter: SearchDto) {}
 */
export const Query = (pathPattern?: string, middlewares?: MiddlewareCB[]) => {
  return Endpoint(HTTP_METHODS.QUERY, pathPattern, middlewares);
};

/**
 * Catch-all decorator: matches any method on any sub-path (`*`).
 *
 * @param middlewares - Optional array of middlewares.
 */
export function Any(middlewares?: MiddlewareCB[]) {
  return Endpoint(HTTP_METHODS.ANY, '*', middlewares);
}
