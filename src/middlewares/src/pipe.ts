import { type Pipe } from './types/core';
import { defineMiddlewaresMeta } from './utils/shared';
/**
 * Decorator to register a data transformation pipe.
 *
 * Pipes are used to transform incoming request data before it reaches
 * the route handler. They can be applied at the controller level and
 * modify parts of the request such as body, query, params, or headers.
 *
 * @param config - Configuration object containing transformation functions
 * for different parts of the request.
 *
 * @returns A class decorator that attaches pipe metadata to the target.
 *
 * @example
 * @Pipe({
 *   body: (body) => ({ ...body, name: body.name.trim() }),
 *   query: (query) => ({ ...query, page: Number(query.page) }),
 * })
 * class MyController {}
 *
 * @remarks
 * Each function in the pipe receives raw data and must return the transformed value.
 * Pipes are executed before controller methods and can be used for:
 * - data normalization
 * - type casting
 * - sanitization
 *
 * Metadata is stored under the CONTROLLER_CONFIGUARTION key and later used
 * by the framework during request processing.
 */
export function Pipe(pipe: Pipe) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = { pipes: [pipe] };

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
