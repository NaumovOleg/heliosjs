import type { Request } from './request';

export type RolesExtractor = (
  req: Request,
) => string | string[] | undefined | Promise<string | string[] | undefined>;

export interface RBACConfig {
  /** Returns the role(s) for the current request. */
  getRoles: RolesExtractor;
}
