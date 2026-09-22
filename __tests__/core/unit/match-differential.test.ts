import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller, Endpoint } from '@heliosjs/core';
import { HTTP_METHODS } from '@heliosjs/core/types';
import type { ControllerClass, ControllerMeta, Route } from '@heliosjs/core/types';
import { findRoute } from '@heliosjs/core/utils';
import { CONTROLLER_PRECOMPILED } from '@heliosjs/core/constants';
import { makeControllerMeta, makeRoute } from '../../helpers/http';
import { legacyFindRoute } from '../helpers/legacy-match';

// Differential fuzz: random route tables + random/adversarial query paths, compared
// against the frozen pre-trie matcher (legacy-match.ts). Seeded PRNG inline (same
// reasoning as router-fuzz.test.ts: a small deterministic corpus generator beats
// pulling in a property-testing dependency for a router this size). This test must
// keep passing byte-for-byte once findRoute switches to a trie index — see
// .planning/phases/01-route-trie/01-01-PLAN.md Task 2's verify step for how to prove
// it can actually fail (temporarily break the matcher, confirm red, revert).

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['users', 'orders', 'files', 'admin', 'profile', 'search', 'items', 'tags', 'a', 'b'];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function word(rng: () => number, lower = false): string {
  const w = pick(rng, WORDS);
  return lower ? w.toLowerCase() : w;
}

// Same precedence order as compileRouteRegex in controller.ts: '*' first, then
// ':name(regex)', then trailing '?', then ':name', then static.
function genSegmentText(rng: () => number, idx: number): string {
  const r = rng();
  if (r < 0.08) return '*';
  if (r < 0.16) return `:opt${idx}?`;
  if (r < 0.3) return `:id${idx}(\\d+)`;
  if (r < 0.42) return `:slug${idx}([a-z]+)`;
  if (r < 0.6) return `:p${idx}`;
  return word(rng);
}

const METHODS = [
  HTTP_METHODS.GET,
  HTTP_METHODS.GET,
  HTTP_METHODS.GET,
  HTTP_METHODS.POST,
  HTTP_METHODS.DELETE,
  HTTP_METHODS.ANY,
];
const QUERY_METHODS = ['GET', 'POST', 'DELETE', 'HEAD', 'PUT'];

function buildTree(rng: () => number, depth: number): ControllerClass {
  const routeCount = 3 + Math.floor(rng() * 6);

  class Cls {}
  for (let i = 0; i < routeCount; i++) {
    const fnName = `h${i}`;
    (Cls.prototype as any)[fnName] = function handler() {
      return { ok: true };
    };
    const segCount = 1 + Math.floor(rng() * 3);
    const path = '/' + Array.from({ length: segCount }, (_, j) => genSegmentText(rng, j)).join('/');
    const method = pick(rng, METHODS);
    Endpoint(method, path)(Cls.prototype, fnName, Object.getOwnPropertyDescriptor(Cls.prototype, fnName)! as any);
  }

  const children: ControllerClass[] = [];
  if (depth > 0 && rng() < 0.6) {
    const childCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < childCount; i++) children.push(buildTree(rng, depth - 1));
  }

  const prefix = '/' + word(rng);
  const config = children.length ? { prefix, controllers: children } : prefix;
  return Controller(config as string)(Cls) as ControllerClass;
}

function flattenRoutes(meta: ControllerMeta): Route[] {
  const acc: Route[] = [...meta.routes];
  for (const child of meta.children ?? []) acc.push(...flattenRoutes(child));
  return acc;
}

// Inverse of genSegmentText: given a compiled pattern segment, produce a matching
// (or, for optional/wildcard, possibly empty) list of path segments. Mirrors
// compileRouteRegex's own classification order.
function sampleSegment(seg: string, isLast: boolean, rng: () => number): string[] {
  if (seg === '*') {
    const min = isLast ? 0 : 1;
    const n = min + Math.floor(rng() * 3);
    return Array.from({ length: n }, () => word(rng));
  }
  const regexMatch = seg.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)\((.+)\)$/);
  if (regexMatch) {
    const body = regexMatch[2];
    if (body === '\\d+') return [String(1 + Math.floor(rng() * 999))];
    if (body === '[a-z]+') return [word(rng, true)];
    return [word(rng, true)];
  }
  if (seg.endsWith('?')) {
    return rng() < 0.5 ? [word(rng)] : [];
  }
  if (seg.startsWith(':')) {
    return [word(rng)];
  }
  return [seg];
}

function sampleQueryFor(route: Route, rng: () => number): string {
  const segs = route.compiledSegments ?? route.route.split('/').filter((s) => s.length > 0);
  const parts = segs.flatMap((seg, i) => sampleSegment(seg, i === segs.length - 1, rng));
  return parts.length ? '/' + parts.join('/') : '/';
}

function mutate(path: string, rng: () => number): string {
  const segs = path.split('/').filter((s) => s.length > 0);
  switch (Math.floor(rng() * 5)) {
    case 1:
      return path + '/' + word(rng);
    case 2:
      return segs.length > 1 ? '/' + segs.slice(0, -1).join('/') : path;
    case 3:
      return path + '/';
    case 4:
      return path.replace('/', '//');
    default:
      return path;
  }
}

// Mirrors ADVERSARIAL_PATHS in router-fuzz.test.ts — kept as a separate literal
// copy since that file doesn't export it, and these attack/edge shapes are exactly
// what a trie rewrite is most likely to mishandle.
const ADVERSARIAL_PATHS = [
  '/users/../admin',
  '/../../etc/passwd',
  '//users',
  '/users//1',
  '///',
  '',
  '/',
  '/users/\x00',
  '/users/\t1',
  '/' + 'a/'.repeat(1000) + 'users',
  '/üsers/1',
  '/users/(.*)$',
  '/users/[a-z]+',
  '/users/$1',
  '/users/\\',
];

function assertParity(meta: ControllerMeta, path: string, method: string, label: string) {
  const actual = findRoute(meta, path, method);
  const expected = legacyFindRoute(meta, path, method);
  expect(actual?.route, label).toBe(expected?.route);
  if (expected) {
    expect(actual?.params, label).toEqual(expected.params);
  }
}

describe('router differential: current matcher vs frozen legacy oracle', () => {
  it('agrees on route identity and params across random route tables', () => {
    const SEED = 424242;
    const rng = mulberry32(SEED);
    let cases = 0;

    for (let t = 0; t < 40; t++) {
      const RootWrapped = buildTree(rng, 2);
      const parentMeta = { prefix: '/', name: 'root', functions: [], routes: [], controllers: [] };
      const instance = new RootWrapped(parentMeta) as unknown as {
        [CONTROLLER_PRECOMPILED]: ControllerMeta;
      };
      const meta = instance[CONTROLLER_PRECOMPILED];
      const routes = flattenRoutes(meta);
      if (routes.length === 0) continue;

      const paths = new Set<string>();
      for (const route of routes) {
        for (let s = 0; s < 3; s++) {
          paths.add(mutate(sampleQueryFor(route, rng), rng));
        }
      }
      for (const p of ADVERSARIAL_PATHS) paths.add(p);

      for (const path of paths) {
        for (const method of QUERY_METHODS) {
          cases++;
          assertParity(meta, path, method, `seed=${SEED} table=${t} path=${JSON.stringify(path)} method=${method}`);
        }
      }
    }

    expect(cases).toBeGreaterThan(2000);
  });

  it('agrees on hand-built routes without compiledRegex', () => {
    const routes = [
      makeRoute({ name: 'list', route: '/users', method: 'GET' }),
      makeRoute({ name: 'one', route: '/users/:id', method: 'GET' }),
      makeRoute({ name: 'wild', route: '/files/*', method: 'GET' }),
      makeRoute({ name: 'opt', route: '/search/:q?', method: 'GET' }),
      makeRoute({ name: 'any', route: '/ping', method: 'ANY' }),
    ];
    const meta = makeControllerMeta({ routes });
    const paths = [
      '/users',
      '/users/42',
      '/files',
      '/files/a/b/c',
      '/search',
      '/search/x',
      '/ping',
      '/nope',
      '/users/',
      '//users',
    ];

    for (const path of paths) {
      for (const method of QUERY_METHODS) {
        assertParity(meta, path, method, `path=${JSON.stringify(path)} method=${method}`);
      }
    }
  });
});
