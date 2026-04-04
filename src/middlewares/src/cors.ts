import { CONTROLLER_CONFIG, CORS_METADATA } from './constants';
import { CORSConfig, HTTP_METHODS } from './types/core';
import { reflectMeta } from './utils/shared';

/**
 * Decorator to configure Cross-Origin Resource Sharing (CORS) settings for HTTP controllers or methods.
 *
 * This decorator allows you to specify CORS policies such as allowed origins, HTTP methods, and
 * the status code to return for successful OPTIONS requests. It can be applied at the class level
 * to affect all endpoints within a controller or at the method level to customize CORS for specific endpoints.
 *
 * When applied, the decorator defines metadata on the target (class prototype or method) which can be
 * later retrieved by the framework to enforce CORS policies during request handling.
 *
 * @param {CORSConfig} [config={}] - Configuration object for CORS settings.
 * @param {string|string[]} [config.origin='*'] - Specifies the allowed origin(s) for CORS requests. Defaults to '*'.
 * @param {number} [config.optionsSuccessStatus=204] - HTTP status code to return for successful OPTIONS requests.
 * @param {string[]} [config.methods=Object.keys(HTTP_METHODS)] - Array of allowed HTTP methods for CORS.
 *
 * @returns {Function} A decorator function that applies the CORS configuration metadata.
 *
 * @example
 * // Apply CORS with default settings to all endpoints in a controller
 * @Cors()
 * class MyController {
 *   // ...
 * }
 *
 * @example
 * // Apply CORS with custom settings to a specific method
 * @Cors({ origin: 'https://example.com', methods: ['GET', 'POST'] })
 * async myMethod() {
 *   // ...
 * }
 *
 * @remarks
 * The metadata key used for storing the CORS configuration is defined by `CORS_METADATA`.
 * This metadata is accessible via Reflect API and used internally by the framework to enforce CORS.
 */
export function Cors(config: CORSConfig = {}) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const defaultConfig: CORSConfig = {
      origin: '*',
      optionsSuccessStatus: 204,
      methods: Object.keys(HTTP_METHODS),
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (propertyKey && descriptor) {
      Reflect.defineMetadata(CORS_METADATA, finalConfig, target, propertyKey);
    } else {
      const meta = reflectMeta(target, 'sub');
      meta.cors.push(finalConfig);
      Reflect.defineMetadata(CONTROLLER_CONFIG, meta, target);
    }
  };
}
