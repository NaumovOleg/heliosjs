import { OK_METADATA_KEY } from './constants';

/**
 * Decorator to set the HTTP status code for the response.
 *
 * This decorator can be applied at the method level to specify the HTTP status code
 * that should be returned when the method's response is sent. It can also be applied
 * at the class level to set a default status code for all methods within the class.
 *
 * The status code is stored as metadata on the target or method, which can be retrieved
 * by the framework to set the HTTP response status accordingly.
 *
 * @param {number} status - The HTTP status code to set for the response.
 *
 * @returns {Function} A decorator function that applies the status code metadata.
 *
 * @example
 * // Set status code 201 for a specific method
 * @Status(201)
 * async createResource() {
 *   // ...
 * }
 *
 * @example
 * // Set default status code 204 for all methods in a controller
 * @Status(204)
 * class MyController {
 *   // ...
 * }
 *
 * @remarks
 * The metadata key used for storing the status code is defined by `OK_METADATA_KEY`.
 * This metadata is accessible via Reflect API and used internally by the framework
 * to set the HTTP response status.
 */
export function Status(status: number) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>,
  ): void {
    if (!propertyKey) {
      Reflect.defineMetadata(OK_METADATA_KEY, status, target.prototype || target);
      return;
    }

    if (descriptor) {
      Reflect.defineMetadata(OK_METADATA_KEY, status, target, propertyKey);
    }
  };
}

/**
 * Shortcut decorator to set HTTP 200 OK status.
 *
 * This decorator is a convenient alias for `@Status(200)`.
 * It can be applied at the method or class level to indicate a successful response.
 *
 * @returns {Function} A decorator function that sets the HTTP status to 200.
 */
export const Ok200 = () => Status(200);

/**
 * Shortcut decorator to set HTTP 201 Created status.
 *
 * This decorator is a convenient alias for `@Status(201)`.
 * It can be applied at the method or class level to indicate a resource creation success.
 *
 * @returns {Function} A decorator function that sets the HTTP status to 201.
 */
export const Ok201 = () => Status(201);

/**
 * Shortcut decorator to set HTTP 204 No Content status.
 *
 * This decorator is a convenient alias for `@Status(204)`.
 * It can be applied at the method or class level to indicate a successful response
 * with no content.
 *
 * @returns {Function} A decorator function that sets the HTTP status to 204.
 */
export const Ok204 = () => Status(204);
