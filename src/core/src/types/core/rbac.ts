import type { Request } from './request';

/**
 * Function that resolves the role(s) of the caller for a request — e.g. from a
 * decoded JWT claim or a session lookup. Registered via `setRolesExtractor` /
 * `@Server({ rbac: { getRoles } })` and consulted by the `@Roles` guard. Return
 * `undefined` (or `[]`) for an anonymous/unauthenticated request.
 */
export type RolesExtractor = (
  req: Request,
) => string | string[] | undefined | Promise<string | string[] | undefined>;

/** Role-based access control configuration, consumed by the `@Roles` guard. */
export interface RBACConfig {
  /** Returns the role(s) for the current request. */
  getRoles: RolesExtractor;
}
