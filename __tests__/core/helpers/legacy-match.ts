import type { ControllerMeta, Route } from '@heliosjs/core/types';

// Frozen copy of the linear matcher as of 9220000 (src/core/src/utils/core/match.ts,
// pre route-trie rewrite) — do not edit; oracle for match-differential.test.ts. This
// is a straight copy of normalizePath/matchCompiledRegex/extractParamsAndWildcard/
// isMethodMatch/routeSpecificity/findRoute as they existed before the trie index
// replaced the scan in findRoute. Keep every quirk, including ones that look fixable.
// normalizePath isn't part of the public @heliosjs/core/utils barrel (match.ts
// imports it from a relative sibling file), so it's inlined here too rather than
// reaching into src internals.

function normalizePath(path: string): string {
  if (!path) return '/';
  const withoutQuery = path.split('?')[0];
  return (
    '/' +
    withoutQuery
      .split('/')
      .filter((p) => p.length > 0)
      .join('/')
  );
}

function legacyMatchCompiledRegex(
  route: Route,
  normalizedPath: string
): Record<string, string> | null {
  if (!route.compiledRegex) {
    return legacyExtractParamsAndWildcard(route.route, normalizedPath);
  }

  const match = route.compiledRegex.exec(normalizedPath);
  if (!match) return null;

  const segments = route.compiledSegments ?? route.route.split('/').filter((s) => s.length > 0);
  const params: Record<string, string> = {};
  let groupIndex = 1;

  segments.forEach((seg, i) => {
    if (seg === '*') {
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

function legacyExtractParamsAndWildcard(
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

function legacyIsMethodMatch(routeMethod: string, requestMethod: string): boolean {
  return routeMethod === 'ANY' || routeMethod === requestMethod;
}

function legacyRouteSpecificity(route: string): string {
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

/** Oracle: same signature/behavior as the pre-trie `findRoute` in match.ts. */
export function legacyFindRoute(
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
      if (!legacyIsMethodMatch(route.method, method)) continue;

      const key = route.specificity ?? legacyRouteSpecificity(route.route);
      if (key <= bestKey) continue;

      const params = legacyMatchCompiledRegex(route, normalizedRequestPath);
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

  if (!best && requestMethod === 'HEAD') {
    method = 'GET';
    searchInController(controller);
  }

  return best ? { route: best, params: bestParams ?? {} } : undefined;
}
