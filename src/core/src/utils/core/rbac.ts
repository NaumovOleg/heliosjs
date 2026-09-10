import type { RolesExtractor } from '../../types/core/rbac';

let extractor: RolesExtractor | undefined;

/**
 * Registers the process-wide function that maps a request to its role(s). The
 * `@Roles` guard calls it on every protected route; without it `@Roles` throws
 * {@link InvalidStateError}. Adapters call this for you from
 * `@Server({ rbac: { getRoles } })` / `new Helios(ctrl, { rbac })`.
 *
 * @param fn - `(req) => string | string[] | undefined` (may be async). Return the
 *   caller's role(s), or `undefined`/`[]` for an anonymous request. Why: RBAC is
 *   app-specific (JWT claim, session lookup, DB) — the framework only needs the
 *   resulting roles. Pass `undefined` to clear.
 */
export function setRolesExtractor(fn: RolesExtractor | undefined): void {
  extractor = fn;
}

/**
 * Returns the currently registered roles extractor, or `undefined` if none was
 * set. Used internally by the `@Roles` guard.
 */
export function getRolesExtractor(): RolesExtractor | undefined {
  return extractor;
}
