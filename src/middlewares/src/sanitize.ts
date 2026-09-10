import type { SanitizerConfig } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Runs a Joi schema over one part of the request on a controller class or a
 * single route method. Sanitizers run first in the pipeline (before guards), so
 * every later stage sees the cleaned/validated data.
 *
 * Depending on `action` a config either validates (throws on mismatch),
 * sanitizes (coerces/strips and writes the result back onto the request), or
 * both. The `SANITIZER` helper from `@heliosjs/core` provides ready-made Joi
 * builders (`SANITIZER.string.email()`, `SANITIZER.xss()`, …).
 *
 * @param config - One `SanitizerConfig`, or an array applied in order. Each has:
 *   - `schema` (**required**) — a `Joi.Schema` to run.
 *   - `type` (**required**) — which request part to target, one of
 *     `'body'`, `'query'`, `'params'`, `'headers'`.
 *   - `action` — `'validate'` (reject on error), `'sanitize'` (transform in
 *     place), or `'both'`. Default `'both'`.
 *   - `options` — Joi `ValidationOptions` passed through.
 *   - `stripUnknown` — drop keys not in the schema.
 *   Why an array: apply different schemas to different request parts on the same
 *   route.
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Sanitize({
 *   type: 'body',
 *   action: 'both',
 *   schema: Joi.object({ email: SANITIZER.string.email(), bio: SANITIZER.xss() }),
 *   stripUnknown: true,
 * })
 * class ProfileController {}
 */
export function Sanitize(config: SanitizerConfig | SanitizerConfig[]) {
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const sanitizers = Array.isArray(config) ? config : [config];
    const data = sanitizers.map(sanitizer => ({ sanitizer }));

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
