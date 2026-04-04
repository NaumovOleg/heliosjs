import { CONTROLLER_CONFIG } from './constants';
import { ErorrHandler } from './types/core';

import { reflectMeta } from './utils/shared';
/**
 * Decorator to register a global or controller-level error handler.
 *
 * This decorator accepts an error handling callback function which will be invoked
 * whenever an error occurs within the decorated target's scope (e.g., controller or service).
 * It attaches the handler as metadata on the target class, allowing the framework to
 * retrieve and execute the error handler appropriately during runtime.
 *
 * @param {ErorrHandler} handler - The error callback function to handle errors.
 *
 * @returns {Function} A class decorator function that defines the error handler metadata.
 *
 * @example
 * // Register a global error handler for a controller
 * @Catch(async (error, context) => {
 *   console.error('Error caught:', error);
 *   // Custom error handling logic
 * })
 * class MyController {
 *   // ...
 * }
 *
 * @remarks
 * The metadata key used for storing the error handler is defined by `CATCH`.
 * This metadata is accessible via Reflect API and used internally by the framework
 * to invoke the registered error handler when errors occur.
 */
export function Catch(handler: ErorrHandler) {
  return function (target: any) {
    const meta = reflectMeta(target, 'sub');
    meta.catch.push(handler);
    Reflect.defineMetadata(CONTROLLER_CONFIG, meta, target);

    return target;
  };
}
