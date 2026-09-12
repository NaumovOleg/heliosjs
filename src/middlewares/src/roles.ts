import type { GuardFunction } from '@heliosjs/core/types';
import { getRolesExtractor, InvalidStateError, defineMiddlewaresMeta } from '@heliosjs/core/utils';

/** Role match policy for `@Roles`: `'any'` (at least one required role) or `'all'` (every required role). */
export type RoleMode = 'any' | 'all';

/** Trailing options object accepted by `@Roles`. */
export interface RolesOptions {
  /** Match policy. Default `'any'`. */
  mode?: RoleMode;
  /** Denial message when the check fails. Default `'Insufficient role'`. */
  message?: string;
}

type RolesArg = string | string[];

/**
 * @internal `true` when `userRoles` satisfies `required` under `mode` (`'all'`:
 * every required role present; otherwise: at least one).
 */
export function matchRoles(required: string[], userRoles: string[], mode: RoleMode): boolean {
  if (required.length === 0) return false;
  return mode === 'all'
    ? required.every((role) => userRoles.includes(role))
    : required.some((role) => userRoles.includes(role));
}

/** @internal Splits `@Roles(...)`'s variadic arguments into a flat role list plus the trailing options object, if any. */
export function normalizeArgs(args: (RolesArg | RolesOptions)[]): {
  roles: string[];
  options: RolesOptions;
} {
  let options: RolesOptions = {};
  let roleArgs = args;

  const last = args[args.length - 1];
  const isOptions = typeof last === 'object' && last !== null && !Array.isArray(last);

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

/** @internal Builds the `GuardFunction` `@Roles` registers via `@Guard`, using the configured `RolesExtractor`. */
export function createRolesGuard(required: string[], options: RolesOptions): GuardFunction {
  const mode = options.mode ?? 'any';
  const message = options.message ?? 'Insufficient role';

  return async (req) => {
    const extractor = getRolesExtractor();
    if (!extractor) {
      throw new InvalidStateError('RBAC extractor not set; configure rbac.getRoles in @Server');
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ guard }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
