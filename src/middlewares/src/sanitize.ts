import { SanitizerConfig } from './types/core';
import { defineMiddlewaresMeta } from './utils/shared';
/**
 * Decorator to apply sanitization configurations to a controller or method.
 *
 * This decorator accepts one or more sanitization configuration objects which define
 * how incoming request data should be sanitized before processing. It can be applied
 * at the class level to apply sanitization globally to all methods or at the method level
 * for fine-grained control.
 *
 * The sanitization configurations are stored as metadata on the target or method,
 * which can be retrieved by the framework to perform the actual sanitization during
 * request handling.
 *
 * @param {SanitizerConfig | SanitizerConfig[]} sanitizeConfig - A single or array of sanitization configuration objects.
 *
 * @returns {Function} A decorator function that applies the sanitization metadata.
 *
 * @example
 * // Apply sanitization to all methods in a controller
 * @Sanitize({ trim: true, escape: true })
 * class MyController {
 *   // ...
 * }
 *
 * @example
 * // Apply multiple sanitization rules to a specific method
 * @Sanitize([
 *   { trim: true },
 *   { escape: true }
 * ])
 * async myMethod() {
 *   // ...
 * }
 *
 * @remarks
 * The metadata key used for storing the sanitization configurations is defined by `SANITIZE`.
 * This metadata is accessible via Reflect API and used internally by the framework
 * to apply sanitization logic.
 */
export function Sanitize(sanitizeConfig: SanitizerConfig | SanitizerConfig[]) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = { sanitizers: Array.isArray(sanitizeConfig) ? sanitizeConfig : [sanitizeConfig] };

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
