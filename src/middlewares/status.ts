import { OK_METADATA_KEY } from '@constants';

/**
 * Method or class decorator to set the HTTP status code for the response.
 * @param status HTTP status code to set.
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
 */
export const Ok200 = () => Status(200);

/**
 * Shortcut decorator to set HTTP 201 Created status.
 */
export const Ok201 = () => Status(201);

/**
 * Shortcut decorator to set HTTP 204 No Content status.
 */
export const Ok204 = () => Status(204);
