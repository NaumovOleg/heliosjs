import type { GuardFunction } from '@heliosjs/core/types';
import { getRolesExtractor, InvalidStateError, defineMiddlewaresMeta } from '@heliosjs/core/utils';

export type RoleMode = 'any' | 'all';

export interface RolesOptions {
  mode?: RoleMode;
  message?: string;
}

type RolesArg = string | string[];

export function matchRoles(
  required: string[],
  userRoles: string[],
  mode: RoleMode,
): boolean {
  return mode === 'all'
    ? required.every((role) => userRoles.includes(role))
    : required.some((role) => userRoles.includes(role));
}

export function normalizeArgs(
  args: (RolesArg | RolesOptions)[],
): { roles: string[]; options: RolesOptions } {
  let options: RolesOptions = {};
  let roleArgs = args;

  const last = args[args.length - 1];
  const isOptions =
    typeof last === 'object' && last !== null && !Array.isArray(last);

  if (isOptions) {
    options = last as RolesOptions;
    roleArgs = args.slice(0, -1);
  }

  const roles = roleArgs.flatMap((arg) => {
    if (Array.isArray(arg)) return arg;
    if (typeof arg === 'string') return [arg];
    return [];
  });

  return { roles, options };
}

export function createRolesGuard(
  required: string[],
  options: RolesOptions,
): GuardFunction {
  const mode = options.mode ?? 'any';
  const message = options.message ?? 'Insufficient role';

  return async (req) => {
    const extractor = getRolesExtractor();
    if (!extractor) {
      throw new InvalidStateError(
        'RBAC extractor not set; configure rbac.getRoles in @Server',
      );
    }

    const raw = await extractor(req);
    const userRoles = raw == null ? [] : Array.isArray(raw) ? raw : [raw];

    return matchRoles(required, userRoles, mode) ? true : message;
  };
}

/**
 * Restrict a controller or route to users holding the required role(s).
 *
 * Roles are read through the extractor configured via `@Server({ rbac })`.
 * Default match mode is ANY (the user needs at least one listed role); pass
 * `{ mode: 'all' }` to require every role. A failing check throws
 * `ForbiddenError` with `options.message` (default `"Insufficient role"`).
 *
 * @example
 * @Roles('admin')
 * @example
 * @Roles('admin', 'editor')                     // ANY
 * @example
 * @Roles(['admin', 'editor'], { mode: 'all' })  // ALL
 */
export function Roles(...args: (RolesArg | RolesOptions)[]) {
  const { roles, options } = normalizeArgs(args);
  const guard = createRolesGuard(roles, options);

  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = [{ guard }];

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
