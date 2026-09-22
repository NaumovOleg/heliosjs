import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller, Endpoint } from '@heliosjs/core';
import { HTTP_METHODS } from '@heliosjs/core/types';
import type { ControllerClass, ControllerMeta } from '@heliosjs/core/types';
import { findRoute } from '@heliosjs/core/utils';
import { CONTROLLER_PRECOMPILED } from '@heliosjs/core/constants';
import { makeControllerMeta, makeRoute } from '../../helpers/http';

// Deterministic cases match-differential.test.ts's random corpus might not hit
// reliably — each one pins down a specific branch of the trie in match.ts.

interface RouteSpec {
  method: HTTP_METHODS;
  path: string;
  name: string;
}

function build(specs: RouteSpec[]): ControllerMeta {
  class Cls {}
  for (const spec of specs) {
    (Cls.prototype as any)[spec.name] = function handler() {
      return { name: spec.name };
    };
    Endpoint(
      spec.method,
      spec.path
    )(Cls.prototype, spec.name, Object.getOwnPropertyDescriptor(Cls.prototype, spec.name)! as any);
  }
  const Wrapped = Controller('/')(Cls) as ControllerClass;
  const parentMeta = { prefix: '/', name: 'root', functions: [], routes: [], controllers: [] };
  const instance = new Wrapped(parentMeta) as unknown as { [CONTROLLER_PRECOMPILED]: ControllerMeta };
  return instance[CONTROLLER_PRECOMPILED];
}

const GET = HTTP_METHODS.GET;

describe('route trie: targeted cases', () => {
  it('matches the root route "/"', () => {
    const meta = build([{ method: GET, path: '/', name: 'root' }]);
    expect(findRoute(meta, '/', 'GET')?.route.name).toBe('root');
  });

  it('trailing wildcard matches zero and many segments', () => {
    const meta = build([{ method: GET, path: '/files/*', name: 'files' }]);
    expect(findRoute(meta, '/files', 'GET')?.params).toEqual({ '*': '' });
    expect(findRoute(meta, '/files/a/b/c', 'GET')?.params).toEqual({ '*': 'a/b/c' });
  });

  it('trailing optional: skip, consume one, reject two', () => {
    const meta = build([{ method: GET, path: '/search/:q?', name: 'search' }]);
    expect(findRoute(meta, '/search', 'GET')?.params).toEqual({});
    expect(findRoute(meta, '/search/x', 'GET')?.params).toEqual({ q: 'x' });
    expect(findRoute(meta, '/search/x/y', 'GET')).toBeUndefined();
  });

  it('specificity ties keep the first-declared route', () => {
    const meta = build([
      { method: GET, path: '/x/:a', name: 'first' },
      { method: GET, path: '/x/:b', name: 'second' },
    ]);
    expect(findRoute(meta, '/x/1', 'GET')?.route.name).toBe('first');
  });

  it('ANY and GET on the same path: first-declared wins', () => {
    const meta = build([
      { method: HTTP_METHODS.ANY, path: '/p', name: 'anyH' },
      { method: GET, path: '/p', name: 'getH' },
    ]);
    expect(findRoute(meta, '/p', 'GET')?.route.name).toBe('anyH');
  });

  it('HEAD falls back to GET, but an explicit HEAD route wins over the fallback', () => {
    const fallback = build([{ method: GET, path: '/h', name: 'getH' }]);
    expect(findRoute(fallback, '/h', 'HEAD')?.route.name).toBe('getH');

    const explicit = build([
      { method: HTTP_METHODS.HEAD, path: '/h2', name: 'headH' },
      { method: GET, path: '/h2', name: 'getH2' },
    ]);
    expect(findRoute(explicit, '/h2', 'HEAD')?.route.name).toBe('headH');
  });

  it('residual regex-param and mid-route-wildcard routes compete with trie routes by specificity', () => {
    const meta = build([
      { method: GET, path: '/mix/:id(\\d+)', name: 'regexP' }, // residual: regex param
      { method: GET, path: '/mix/:name', name: 'plainP' }, // trie: plain param
    ]);
    // More specific regex route wins when its own regex passes.
    expect(findRoute(meta, '/mix/42', 'GET')?.route.name).toBe('regexP');
    // Regex confirm fails on non-digits, falls through to the plain param route.
    expect(findRoute(meta, '/mix/abc', 'GET')?.route.name).toBe('plainP');

    const midWild = build([{ method: GET, path: '/m/*/end', name: 'midWild' }]);
    expect(findRoute(midWild, '/m/x/y/end', 'GET')?.route.name).toBe('midWild');
    expect(findRoute(midWild, '/m/end', 'GET')).toBeUndefined(); // mid-route * needs >=1 segment
  });

  it('matches a hand-built route with no compiledRegex (extractParamsAndWildcard fallback)', () => {
    const route = makeRoute({ name: 'raw', route: '/raw/:id', method: 'GET' });
    const meta = makeControllerMeta({ routes: [route] });
    expect(findRoute(meta, '/raw/9', 'GET')?.params).toEqual({ id: '9' });
  });

  it('handles segments literally named __proto__ / constructor via the Map-backed trie', () => {
    const meta = build([
      { method: GET, path: '/__proto__/x', name: 'protoR' },
      { method: GET, path: '/constructor/y', name: 'ctorR' },
    ]);
    expect(findRoute(meta, '/__proto__/x', 'GET')?.route.name).toBe('protoR');
    expect(findRoute(meta, '/constructor/y', 'GET')?.route.name).toBe('ctorR');
    expect(findRoute(meta, '/__proto__/nope', 'GET')).toBeUndefined();
  });

  it('derives segments from route.route when compiledSegments is absent (hand-set compiledRegex)', () => {
    const route = makeRoute({
      name: 'manual',
      route: '/manual/:id',
      method: 'GET',
      compiledRegex: /^\/manual\/([^/]+)\/?$/,
      specificity: '425',
    });
    const meta = makeControllerMeta({ routes: [route] });
    expect(findRoute(meta, '/manual/7', 'GET')?.params).toEqual({ id: '7' });
  });

  it('tolerates a ControllerMeta with no children property at all', () => {
    const route = makeRoute({ name: 'x', route: '/x', method: 'GET' });
    const meta = { prefix: '/', name: 'root', routes: [route], controllers: [] } as ControllerMeta;
    expect(findRoute(meta, '/x', 'GET')?.route.name).toBe('x');
  });

  it('caches the index per controller-tree root: repeated lookups agree, and a post-lookup mutation is not picked up', () => {
    const meta = build([{ method: GET, path: '/cache1', name: 'first' }]);
    const a = findRoute(meta, '/cache1', 'GET');
    const b = findRoute(meta, '/cache1', 'GET');
    expect(a?.route).toBe(b?.route);

    // The index is built lazily on first lookup and cached on the meta object;
    // routes added afterward aren't picked up (see match.ts's "Route index"
    // comment — nothing in src/__tests__ mutates routes post-construction).
    meta.routes.push(makeRoute({ name: 'second', route: '/cache2', method: 'GET' }));
    expect(findRoute(meta, '/cache2', 'GET')).toBeUndefined();
  });
});
