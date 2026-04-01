import { ControllerMeta, Route } from '../../types/core';
import { normalizePath } from './helper';

function extractParamsAndWildcard(
  routePattern: string,
  actualPath: string,
): { params: Record<string, string>; wildcardMatch?: string } | null {
  // Разбиваем на сегменты
  const patternSegments = routePattern.split('/').filter((s) => s.length > 0);
  const pathSegments = actualPath.split('/').filter((s) => s.length > 0);

  const params: Record<string, string> = {};
  let wildcardMatch: string | undefined;
  let pathIndex = 0;

  for (const element of patternSegments) {
    const pattern = element;
    if (pathIndex >= pathSegments.length) {
      if (pattern.endsWith('?')) {
        continue;
      }
      return null;
    }
    if (pattern === '*') {
      wildcardMatch = pathSegments.slice(pathIndex).join('/');
      return { params, wildcardMatch };
    }
    const regexMatch = pattern.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)\((.+)\)$/);
    if (regexMatch) {
      const paramName = regexMatch[1];
      const regexPattern = regexMatch[2];
      const currentSegment = pathSegments[pathIndex];

      const regex = new RegExp(`^${regexPattern}$`);
      if (!regex.test(currentSegment)) {
        return null;
      }

      params[paramName] = currentSegment;
      pathIndex++;
      continue;
    }
    if (pattern.endsWith('?')) {
      const paramName = pattern.slice(1, -1);
      if (pathIndex < pathSegments.length) {
        params[paramName] = pathSegments[pathIndex];
        pathIndex++;
      }
      continue;
    }
    if (pattern.startsWith(':')) {
      const paramName = pattern.slice(1);
      params[paramName] = pathSegments[pathIndex];
      pathIndex++;
      continue;
    }
    if (pattern !== pathSegments[pathIndex]) {
      return null;
    }
    pathIndex++;
  }
  if (pathIndex !== pathSegments.length) {
    return null;
  }

  return { params };
}

function isMethodMatch(routeMethod: string, requestMethod: string): boolean {
  return routeMethod === 'ANY' || routeMethod === requestMethod;
}

export function matchRoutes(
  controller: ControllerMeta,
  requestPath: string,
  requestMethod: string,
) {
  const normalizedRequestPath = normalizePath(requestPath);
  const matches: Route[] = [];

  function searchInController(controller: ControllerMeta): void {
    for (const route of controller.routes) {
      if (!isMethodMatch(route.method, requestMethod)) {
        continue;
      }

      const fullRoutePath = route.route;
      const extracted = extractParamsAndWildcard(fullRoutePath, normalizedRequestPath);

      if (extracted) {
        matches.push(route);

        return;
      }
    }

    for (const child of controller.children ?? []) {
      searchInController(child);
    }
  }

  searchInController(controller);

  return matches.sort((a: any, b: any) => {
    const aWildcard = a.fullPath.includes('*') ? 1 : 0;
    const bWildcard = b.fullPath.includes('*') ? 1 : 0;
    if (aWildcard !== bWildcard) return aWildcard - bWildcard;
    return b.fullPath.length - a.fullPath.length;
  })[0];
}
