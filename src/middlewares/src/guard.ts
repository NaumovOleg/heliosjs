import { type Guard, GuardFn } from './types/core';
import { defineMiddlewaresMeta } from './utils/shared';
/**
 * Decorator to register a guard.
 *
 * Guards are used to control access to a controller by validating
 * incoming requests before they reach route handlers. If a guard
 * returns `false`, the request is blocked.
 *
 * @param guard - A guard class or function used to determine whether
 * the request is allowed to proceed.
 *
 * @returns A class decorator that attaches guard metadata to the target.
 *
 * @example
 * // Using function guard
 * @Guard((req, res) => {
 *   return !!req.headers.authorization;
 * })
 * class MyController {}
 *
 * @example
 * // Using class-based guard
 * class AuthGuard {
 *   canActivate(req: Request, res: Response) {
 *     return !!req.headers.authorization;
 *   }
 * }
 *
 * @Guard(AuthGuard)
 * class MyController {}
 *
 * @remarks
 * Guards are executed before controller methods.
 * They can be used for:
 * - authentication
 * - authorization
 * - request validation
 *
 * If any guard returns `false`, the request handling is stopped.
 *
 * Metadata is stored under the CONTROLLER_CONFIGUARTION key and used
 * internally by the framework during request processing.
 */
export function Guard(guard: Guard | GuardFn) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = { guards: [guard] };

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
