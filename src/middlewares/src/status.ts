import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Sets the HTTP status code for successful responses from a controller class or a
 * single route method. Method-level wins over class-level. Without it a
 * successful handler responds `200` (or the code you set via `res.status`).
 *
 * This only affects the success path — errors still carry the status of the
 * thrown `HeliosError`, and an explicit `res.redirect()` keeps its own code.
 *
 * @param status - The HTTP status code to send, e.g. `201` for a create, `202`
 *   for an accepted async job, `204` for an empty body. Why: express REST
 *   semantics without touching the `Response` object.
 *
 * @returns A class or method decorator.
 *
 * @example
 * class UserController {
 *   @Post('/')
 *   @Status(201)
 *   create(@Body() dto: CreateUserDto) {}
 * }
 */
export function Status(status: number) {
  return function (target: any, propertyKey?: string): void {
    if (propertyKey) {
      defineMiddlewaresMeta([{ status }], target, propertyKey);
    } else {
      defineMiddlewaresMeta([{ status }], target);
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
