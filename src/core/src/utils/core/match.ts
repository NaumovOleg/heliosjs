import type { ControllerMeta, Route } from '../../types/core';
import { normalizePath } from './helper';

function matchCompiledRegex(route: Route, normalizedPath: string): Record<string, string> | null {
  if (!route.compiledRegex) {
    return extractParamsAndWildcard(route.route, normalizedPath);
  }

  const match = route.compiledRegex.exec(normalizedPath);
  if (!match) return null;

  const segments = route.route.split('/').filter((s) => s.length > 0);
  const params: Record<string, string> = {};
  let groupIndex = 1;

  for (const seg of segments) {
    if (seg === '*') {
      params['*'] = match[groupIndex] ?? '';
      groupIndex++;
    } else if (seg.match(/^:[a-zA-Z_][a-zA-Z0-9_]*\(.+\)$/)) {
      const nameMatch = seg.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)\(/);
      const name = nameMatch?.[1] ?? seg.slice(1);
      params[name] = match[groupIndex] ?? '';
      groupIndex++;
    } else if (seg.endsWith('?')) {
      const paramName = seg.startsWith(':') ? seg.slice(1, -1) : null;
      if (paramName && match[groupIndex]) {
        params[paramName] = match[groupIndex];
      }
      groupIndex++;
    } else if (seg.startsWith(':')) {
      const name = seg.slice(1);
      params[name] = match[groupIndex] ?? '';
      groupIndex++;
    }
  }

  return params;
}

function extractParamsAndWildcard(
  routePattern: string,
  actualPath: string
): Record<string, string> | null {
  const patternSegments = routePattern.split('/').filter((s) => s.length > 0);
  const pathSegments = actualPath.split('/').filter((s) => s.length > 0);

  const params: Record<string, string> = {};
  let pathIndex = 0;

  for (const element of patternSegments) {
    const pattern = element;
    if (pattern === '*') {
      params['*'] = pathSegments.slice(pathIndex).join('/');
      return params;
    }
    if (pathIndex >= pathSegments.length) {
      if (pattern.endsWith('?')) {
        continue;
      }
      return null;
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

  return params;
}

function isMethodMatch(routeMethod: string, requestMethod: string): boolean {
  return routeMethod === 'ANY' || routeMethod === requestMethod;
}

export function matchRoutes(
  controller: ControllerMeta,
  requestPath: string,
  requestMethod: string
) {
  const normalizedRequestPath = normalizePath(requestPath);

  function searchInController(controller: ControllerMeta): Route | undefined {
    for (const route of controller.routes) {
      if (!isMethodMatch(route.method, requestMethod)) {
        continue;
      }

      const extracted = matchCompiledRegex(route, normalizedRequestPath);
      if (extracted !== null) {
        return route;
      }
    }

    for (const child of controller.children ?? []) {
      const found = searchInController(child);
      if (found) return found;
    }

    return undefined;
  }

  return searchInController(controller);
}
