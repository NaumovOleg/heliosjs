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

/**
 * Sortable specificity key: one rank char per segment, compared left to right.
 * static(4) > :param(regex)(3) > :param(2) > optional(1) > *(0). The trailing '5'
 * makes `/a` beat `/a/:id?` or `/a/*` when both match the same path.
 */
export function routeSpecificity(route: string): string {
  let key = '';
  for (const seg of route.split('/')) {
    if (!seg) continue;
    if (seg === '*') key += '0';
    else if (seg.endsWith('?')) key += '1';
    else if (/^:[a-zA-Z_][a-zA-Z0-9_]*\(.+\)$/.test(seg)) key += '3';
    else if (seg.startsWith(':')) key += '2';
    else key += '4';
  }
  return key + '5';
}

export function matchRoutes(
  controller: ControllerMeta,
  requestPath: string,
  requestMethod: string
) {
  const normalizedRequestPath = normalizePath(requestPath);
  let best: Route | undefined;
  let bestKey = '';

  function searchInController(controller: ControllerMeta) {
    for (const route of controller.routes) {
      if (!isMethodMatch(route.method, requestMethod)) continue;

      const key = route.specificity ?? routeSpecificity(route.route);
      // Ties keep the first declared route; lower-ranked routes can't win, skip the regex.
      if (key <= bestKey) continue;

      if (matchCompiledRegex(route, normalizedRequestPath) !== null) {
        best = route;
        bestKey = key;
      }
    }

    for (const child of controller.children ?? []) {
      searchInController(child);
    }
  }

  searchInController(controller);
  return best;
}
