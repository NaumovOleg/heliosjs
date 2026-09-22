import type { ControllerMeta, Route } from '../../types/core';
import { normalizePath } from './helper';

const REGEX_PARAM = /^:[a-zA-Z_][a-zA-Z0-9_]*\(.+\)$/;

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
    if (REGEX_PARAM.test(seg)) {
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
    else if (REGEX_PARAM.test(seg)) key += '3';
    else if (seg.startsWith(':')) key += '2';
    else key += '4';
  }
  return key + '5';
}

// --- Route index -----------------------------------------------------------
//
// findRoute used to be a plain DFS over every route in the controller tree on
// every request (see git history / CONCERNS.md): cheap for a handful of
// routes, but a route's position in the table taxed every request to routes
// declared after it (measured: ~90k req/s down to ~10k req/s at the last
// route of a 300-route table — benchmarks/results-routes.csv). This index
// makes lookup cost depend on path depth instead of table size, while
// changing nothing about *which* route wins: the index only narrows the
// candidate list, the actual decision (highest `specificity`, first-declared
// on ties, method match, then a real regex confirm) is the exact same
// comparison `findRoute` always did — see match-differential.test.ts.
//
// Only "shape-safe" routes are indexed: every segment must be static, a
// plain `:name`, or (last segment only) trailing `?`/`*`. A `:name(regex)`
// segment is never indexed (its regex isn't anchored to one segment — e.g.
// `:p(.*)` can span `/`, so a per-segment trie could disagree with it), and
// neither is a mid-route `*`/`?` or a hand-built route with no compiledRegex
// (its params come from extractParamsAndWildcard, a different algorithm).
// Those stay in `residual`, scanned linearly exactly as before — fine, since
// real route tables have few of them.

interface TrieNode {
  children: Map<string, TrieNode>;
  param?: TrieNode;
  /** Routes whose full pattern ends exactly at this node (static/`:name` only). */
  exact: Route[];
  /** Routes whose trailing segment is `:name?` (or `name?`), hanging off this node. */
  optional: Route[];
  /** Routes whose trailing segment is `*`, hanging off this node. */
  wild: Route[];
}

interface RouteIndex {
  root: TrieNode;
  /** Routes that can't be indexed exactly — checked linearly, like the old matcher. */
  residual: Route[];
  /** Declaration order (root's own routes, then each child's, depth-first — same
   * order the old recursive scan visited them in), used to keep "first declared
   * wins a specificity tie" correct once trie and residual candidates are merged. */
  order: Map<Route, number>;
}

function newNode(): TrieNode {
  return { children: new Map(), exact: [], optional: [], wild: [] };
}

/** A route can be indexed only if every segment's shape is one the trie encodes
 * exactly (see the block comment above); returns its segments if so. */
function classifySegments(route: Route): string[] | null {
  if (!route.compiledRegex) return null;
  const segments = route.compiledSegments ?? route.route.split('/').filter((s) => s.length > 0);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (seg === '*') {
      if (!isLast) return null;
    } else if (REGEX_PARAM.test(seg)) {
      return null;
    } else if (seg.endsWith('?')) {
      if (!isLast) return null;
    }
  }

  return segments;
}

function insertRoute(root: TrieNode, route: Route, segments: string[]) {
  let node = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isLast && seg === '*') {
      node.wild.push(route);
      return;
    }
    if (isLast && seg.endsWith('?')) {
      node.optional.push(route);
      return;
    }
    if (seg.startsWith(':')) {
      node.param ??= newNode();
      node = node.param;
    } else {
      let next = node.children.get(seg);
      if (!next) {
        next = newNode();
        node.children.set(seg, next);
      }
      node = next;
    }
  }
  node.exact.push(route);
}

function buildIndex(rootMeta: ControllerMeta): RouteIndex {
  const root = newNode();
  const residual: Route[] = [];
  const order = new Map<Route, number>();
  let n = 0;

  // Same traversal shape as the old recursive scan: a controller's own routes
  // first, then each child controller in full, depth-first — this is what
  // `order` has to reproduce for tie-breaking to stay identical.
  function visit(meta: ControllerMeta) {
    for (const route of meta.routes) {
      order.set(route, n++);
      const segments = classifySegments(route);
      if (segments) insertRoute(root, route, segments);
      else residual.push(route);
    }
    for (const child of meta.children ?? []) visit(child);
  }
  visit(rootMeta);

  return { root, residual, order };
}

const indexCache = new WeakMap<ControllerMeta, RouteIndex>();

function getIndex(rootMeta: ControllerMeta): RouteIndex {
  let idx = indexCache.get(rootMeta);
  if (!idx) {
    idx = buildIndex(rootMeta);
    indexCache.set(rootMeta, idx);
  }
  return idx;
}

/** Gathers every trie-indexed route whose segment shape could match `segments`
 * (wildcards/optionals included) into `out`. Not yet filtered by method or
 * confirmed by regex — `search` does both against the merged candidate list. */
function collectTrieCandidates(node: TrieNode | undefined, segments: string[], i: number, out: Route[]) {
  if (!node) return;

  out.push(...node.wild); // `*` matches 0+ remaining segments, at any depth

  if (i === segments.length) {
    out.push(...node.exact, ...node.optional); // optional omitted entirely
    return;
  }
  if (i === segments.length - 1) {
    out.push(...node.optional); // optional consuming exactly the last segment
  }

  collectTrieCandidates(node.children.get(segments[i]), segments, i + 1, out);
  collectTrieCandidates(node.param, segments, i + 1, out);
}

function search(
  idx: RouteIndex,
  normalizedPath: string,
  segments: string[],
  method: string
): { route: Route; params: Record<string, string> } | undefined {
  const candidates: Route[] = [];
  collectTrieCandidates(idx.root, segments, 0, candidates);
  candidates.push(...idx.residual);
  // Candidates arrive in trie-traversal order, not declaration order — sort by
  // the precomputed order so ties resolve exactly like the old scan did.
  candidates.sort((a, b) => (idx.order.get(a) ?? 0) - (idx.order.get(b) ?? 0));

  let best: Route | undefined;
  let bestParams: Record<string, string> | undefined;
  let bestKey = '';

  for (const route of candidates) {
    if (!isMethodMatch(route.method, method)) continue;

    const key = route.specificity ?? routeSpecificity(route.route);
    // Ties keep the first declared route; lower-ranked routes can't win, skip the regex.
    if (key <= bestKey) continue;

    const params = matchCompiledRegex(route, normalizedPath);
    if (params !== null) {
      best = route;
      bestParams = params;
      bestKey = key;
    }
  }

  return best ? { route: best, params: bestParams ?? {} } : undefined;
}

/**
 * @internal Looks up the highest-specificity route matching `requestMethod`/
 * `requestPath` (see {@link routeSpecificity} for the ranking), via a
 * per-segment trie built from the controller tree and cached on it (see the
 * "Route index" block above). Falls back from `HEAD` to a matching `GET`
 * route when no explicit `HEAD` route exists. This is the router itself; app
 * code declares routes via `@Get`/`@Post`/… instead of calling it.
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
  const idx = getIndex(controller);
  const normalizedPath = normalizePath(requestPath);
  const segments = normalizedPath.split('/').filter((s) => s.length > 0);

  const result = search(idx, normalizedPath, segments, requestMethod);
  if (result) return result;

  // HEAD falls back to the matching GET handler (Express/Fastify parity); an
  // explicit HEAD route above still wins because this only runs on a miss.
  if (requestMethod === 'HEAD') {
    return search(idx, normalizedPath, segments, 'GET');
  }

  return undefined;
}
