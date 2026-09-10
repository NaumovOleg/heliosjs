import { type Pipe } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Registers a transformation pipe on a controller class or a single route method.
 * Pipes run after guards and before middlewares; each supplied function replaces
 * the matching part of the request with its return value, so the handler and its
 * `@Body()` / `@QueryParam()` decorators see the transformed data.
 *
 * Use pipes for normalization and coercion (trim, lowercase, `Number(...)`,
 * defaults). For schema validation prefer a DTO on the param decorator or
 * `@Sanitize`.
 *
 * @param pipe - An object with any of these keys, each a
 *   `(value, request) => value` transformer:
 *   - `body` — `(body, req) => body`. Why: reshape or clean the parsed body.
 *   - `query` — `(query, req) => query`, where query is
 *     `Record<string, string | string[]>`. Why: coerce query strings to the
 *     types the handler expects.
 *   - `params` — `(params, req) => params`, `Record<string, string>`. Why:
 *     normalize path segments (case, padding).
 *   - `headers` — `(headers, req) => headers`. Why: canonicalize header values.
 *   Omitted keys leave that part untouched.
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Pipe({
 *   body: (body) => ({ ...body, name: body.name?.trim() }),
 *   query: (query) => ({ ...query, page: Number(query.page ?? 1) }),
 * })
 * class MyController {}
 */
export function Pipe(pipe: Pipe) {
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ pipe }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
