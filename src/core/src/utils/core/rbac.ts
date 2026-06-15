import type { RolesExtractor } from '../../types/core/rbac';

let extractor: RolesExtractor | undefined;

export function setRolesExtractor(fn: RolesExtractor | undefined): void {
  extractor = fn;
}

export function getRolesExtractor(): RolesExtractor | undefined {
  return extractor;
}
