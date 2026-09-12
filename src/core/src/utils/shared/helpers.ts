import 'reflect-metadata';
import { DECORATOR } from '../../constants';
import type {
  ControllerMeta,
  MiddlewaresMetadataItem,
  RouteMetadata,
} from '../../types/core/controller';

/** @internal Generates a client id: `crypto.randomUUID()` where available, else a timestamp+random fallback. */
export const generateUniqueId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// One random tag per process (not per call) so ids stay unique across
// restarts/instances without paying `crypto.randomUUID()`'s cost on every
// request.
const REQUEST_ID_PROCESS_TAG = Math.random().toString(36).slice(2, 8);
let requestIdCounter = 0;

/**
 * @internal Fast per-request id: a process-unique tag plus a monotonic
 * counter, both base36. Used for `Request.requestId` on the HTTP hot path —
 * unlike `generateUniqueId`, this needs to be cheap, not unpredictable
 * (nothing security-sensitive keys off it).
 */
export const generateFastRequestId = () => `${REQUEST_ID_PROCESS_TAG}-${requestIdCounter++}`;

const SENSITIVE_FIELD_PATTERN =
  /pass(word|wd)?|secret|token|api[-_]?key|authorization|credit[-_]?card|\bssn\b|\bcvv\b|\bpin\b/i;

/**
 * @internal Replaces `value` with a placeholder when `field` looks like it
 * holds a secret (password, token, API key, …). Used before a validation
 * error's offending value is logged or echoed back in an HTTP response —
 * without this, a failed `@MinLength(8) password` check would log and return
 * the submitted password in cleartext.
 */
export function redactIfSensitive(field: string | undefined, value: unknown): unknown {
  return field && SENSITIVE_FIELD_PATTERN.test(field) ? '[REDACTED]' : value;
}

/** @internal Reads the `@Controller` config stored on a class prototype by `defineControllerMeta`. */
export function reflectControllerMeta(target: object): ControllerMeta {
  const data = Reflect.getMetadata(DECORATOR.controller, target) ?? {};

  if (!data['controllers']) {
    data['controllers'] = [];
  }
  return data;
}
/** @internal Merges `meta` into the `@Controller` config stored on `target` (arrays are concatenated). */
export function defineControllerMeta(meta: Partial<ControllerMeta>, target: object): void {
  const existed = reflectControllerMeta(target);

  const merged = Object.entries(meta).reduce((acc, [key, value]) => {
    if (Array.isArray(acc[key])) {
      acc[key] = acc[key].concat(value);
    } else {
      acc[key] = value;
    }

    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, existed as any);
  Reflect.defineMetadata(DECORATOR.controller, merged, target);
}

/** @internal Reads the raw `MiddlewaresMetadataItem[]` stored on a class (or method) by `defineMiddlewaresMeta`. */
export function reflectMiddlewaresMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any,
  property?: string
): MiddlewaresMetadataItem[] {
  let data;
  if (property) {
    data = Reflect.getMetadata(DECORATOR.middlewares, target, property) ?? [];
  } else {
    data = Reflect.getMetadata(DECORATOR.middlewares, target) ?? [];
  }

  return data;
}

/** @internal Reads one route's `RouteMetadata` (path/method/params) stored by `defineRouteMeta`. */
export function reflectRouteMetadata(target: object, property: string): RouteMetadata {
  const data = Reflect.getMetadata(DECORATOR.route, target, property) ?? {};

  ['parameters', 'middlewares'].forEach((prop) => {
    if (!data[prop]?.length) {
      data[prop] = [];
    }
  });

  return data;
}

/**
 * Records one or more {@link MiddlewaresMetadataItem} entries (a tagged
 * `{ middleware | guard | pipe | sanitizer | interceptor | errorHandler | cors |
 * rateLimit | status }` object) on a class or method. This is the single
 * primitive every `@heliosjs/middlewares` decorator (`@Use`, `@Guard`, `@Pipe`,
 * `@Intercept`, `@Catch`, `@Cors`, `@Status`, `@Roles`, `@Sanitize`,
 * `@RateLimit`) is built from — write your own decorator the same way: build a
 * tagged item and call this.
 *
 * New items are prepended to whatever is already stored, which is what makes
 * multiple stacked decorators on the same class/method compose in declaration
 * order once `collectRoutes` reads them back.
 *
 * @param meta - One or more tagged middleware items to add. Each item should set
 *   exactly one key.
 * @param target - The class prototype (for a class-level decorator) or class
 *   constructor (for a method-level decorator, paired with `property`).
 * @param property - Method name, when decorating a method instead of a class.
 *
 * @example
 * export function Use(mw: MiddlewareCB) {
 *   return (target: any, propertyKey?: string) => {
 *     const item = { middleware: mw };
 *     propertyKey
 *       ? defineMiddlewaresMeta([item], target, propertyKey)
 *       : defineMiddlewaresMeta([item], target);
 *   };
 * }
 */
export function defineMiddlewaresMeta(
  meta: MiddlewaresMetadataItem[],
  target: object,
  property?: string
) {
  const existed = reflectMiddlewaresMetadata(target, property);

  const merged = [...meta, ...(existed ?? [])];
  if (property) {
    Reflect.defineMetadata(DECORATOR.middlewares, merged, target, property);
  } else {
    Reflect.defineMetadata(DECORATOR.middlewares, merged, target);
  }
}

/** @internal Merges `meta` into a route's stored `RouteMetadata` (arrays are concatenated). */
export function defineRouteMeta(
  meta: Partial<RouteMetadata>,
  target: object,
  property: string
): void;
export function defineRouteMeta(meta: Partial<RouteMetadata>, target: object, property: string) {
  const existed = reflectRouteMetadata(target, property);
  const merged = Object.entries(meta).reduce((acc, [key, value]) => {
    if (Array.isArray(acc[key])) {
      acc[key] = acc[key].concat(value);
    } else {
      acc[key] = value;
    }

    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, existed as any);

  Reflect.defineMetadata(DECORATOR.route, merged, target, property);
}
