import type { ControllerMeta, Route } from '../../types/core';
import { normalizePath } from './helper';

/**
 * Extract path params for an already-matched route, using the same regex/segment
 * logic as the matcher (so `:id(\d+)`, `:id?` and `*` all resolve by name).
 */
export function extractRouteParams(route: Route, requestPath: string): Record<string, string> {
  return matchCompiledRegex(route, normalizePath(requestPath)) ?? {};
}

function matchCompiledRegex(route: Route, normalizedPath: string): Record<string, string> | null {
  if (!route.compiledRegex) {
    return extractParamsAndWildcard(route.route, normalizedPath);
  }

  const match = route.compiledRegex.exec(normalizedPath);
  if (!match) return null;

  const segments =
    route.compiledSegments ?? route.route.split('/').filter((s) => s.length > 0);
  const params: Record<string, string> = {};
  let groupIndex = 1;

  segments.forEach((seg, i) => {
    if (seg === '*') {
      // Only a trailing `*` carries a capture group (see compileRouteRegex).
      if (i === segments.length - 1) {
        params['*'] = match[groupIndex] ?? '';
        groupIndex++;
      }
      return;
    }
    if (seg.match(/^:[a-zA-Z_][a-zA-Z0-9_]*\(.+\)$/)) {
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
  });

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

/**
 * @internal Walks a controller's route tree depth-first and returns the
 * highest-specificity route matching `requestMethod`/`requestPath` (see
 * {@link routeSpecificity} for the ranking). Falls back from `HEAD` to a
 * matching `GET` route when no explicit `HEAD` route exists. This is the router
 * itself; app code declares routes via `@Get`/`@Post`/… instead of calling it.
 *
 * @param controller - Root of the compiled controller tree to search.
 * @param requestPath - The incoming request path.
 * @param requestMethod - The incoming request method.
 * @returns The best-matching {@link Route}, or `undefined` if none match.
 */
export function matchRoutes(
  controller: ControllerMeta,
  requestPath: string,
  requestMethod: string
) {
  return findRoute(controller, requestPath, requestMethod)?.route;
}

/**
 * @internal Same search as {@link matchRoutes}, but also returns the params
 * extracted along the way. `matchCompiledRegex` already builds that params
 * object while checking each candidate — `matchRoutes` used to throw it away
 * and `execute` would re-run the same regex to rebuild it. The request
 * pipeline (`descriptors/request.ts`) uses this instead, so routing costs one
 * regex exec per request rather than two; `matchRoutes` stays for callers
 * (tests, direct `execute` calls) that only need the route.
 */
export function findRoute(
  controller: ControllerMeta,
  requestPath: string,
  requestMethod: string
): { route: Route; params: Record<string, string> } | undefined {
  const normalizedRequestPath = normalizePath(requestPath);
  let best: Route | undefined;
  let bestParams: Record<string, string> | undefined;
  let bestKey = '';
  let method = requestMethod;

  function searchInController(controller: ControllerMeta) {
    for (const route of controller.routes) {
      if (!isMethodMatch(route.method, method)) continue;

      const key = route.specificity ?? routeSpecificity(route.route);
      // Ties keep the first declared route; lower-ranked routes can't win, skip the regex.
      if (key <= bestKey) continue;

      const params = matchCompiledRegex(route, normalizedRequestPath);
      if (params !== null) {
        best = route;
        bestParams = params;
        bestKey = key;
      }
    }

    for (const child of controller.children ?? []) {
      searchInController(child);
    }
  }

  searchInController(controller);

  // HEAD falls back to the matching GET handler (Express/Fastify parity); an
  // explicit HEAD route above still wins because this only runs on a miss.
  if (!best && requestMethod === 'HEAD') {
    method = 'GET';
    searchInController(controller);
  }

  return best ? { route: best, params: bestParams ?? {} } : undefined;
}
