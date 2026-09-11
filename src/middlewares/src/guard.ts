import type { GuardFunction, GuardInstance } from '@heliosjs/core/types';
import { type GuardClass } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Registers a guard on a controller class or a single route method. Guards run
 * before pipes, middlewares, and the handler; use them for authentication and
 * authorization checks.
 *
 * A guard grants access by returning `true` and denies by returning `false` or a
 * `string`. On denial the request is rejected with `ForbiddenError` (HTTP 403);
 * a returned string becomes the error message (falling back to
 * `guard.message`, then `"Forbidden"`). Guards may be async.
 *
 * @param guard - One of:
 *   - a **function** `(req, res) => boolean | string | Promise<boolean | string>`;
 *   - a **class** with a `canActivate(req, res)` method (instantiated per request,
 *     may expose a `message` property for the denial text);
 *   - an already-constructed **instance** with `canActivate` (and optional
 *     `message`).
 *   Why: pick the lightest form — a closure for simple checks, a class when the
 *   guard needs its own dependencies.
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Guard((req) => !!req.getHeader('authorization') || 'Missing token')
 * class SecureController {}
 *
 * class RoleGuard {
 *   message = 'Admins only';
 *   canActivate(req: Request) {
 *     return req.getState('role') === 'admin';
 *   }
 * }
 *
 * class AdminController {
 *   @Guard(RoleGuard)
 *   deleteEverything() {}
 * }
 */
export function Guard(guard: GuardClass | GuardFunction | GuardInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ guard: guard }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
