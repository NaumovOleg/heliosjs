import { describe, it, expect, vi } from 'vitest';
import { matchRoutes } from '../../../src/core/src/utils/core/match';
import type { ControllerMeta } from '../../../src/core/src/types/core';

function makeRoute(overrides: any = {}) {
  return {
    name: 'handler',
    route: '/',
    method: 'GET',
    parameters: [],
    functions: [],
    fn: () => undefined,
    cors: undefined,
    ...overrides,
  } as any;
}

function makeController(overrides: any = {}): ControllerMeta {
  return {
    prefix: '/',
    name: 'root',
    routes: [],
    children: [],
    functions: [],
    controllers: [],
    ...overrides,
  } as any;
}

describe('matchRoutes', () => {
  it('matches exact route', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/users', 'GET');
    expect(result).toBeDefined();
    expect(result!.route).toBe('/users');
  });

  it('returns undefined for no match', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/posts', 'GET');
    expect(result).toBeUndefined();
  });

  it('matches ANY method', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users', method: 'ANY' })] });
    const result = matchRoutes(ctrl, '/users', 'POST');
    expect(result).toBeDefined();
  });

  it('skips wrong method', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users', method: 'POST' })] });
    const result = matchRoutes(ctrl, '/users', 'GET');
    expect(result).toBeUndefined();
  });

  it('matches param route :id', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users/:id', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/users/42', 'GET');
    expect(result).toBeDefined();
  });

  it('matches wildcard route', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/files/*', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/files/a/b/c', 'GET');
    expect(result).toBeDefined();
  });

  it('matches regex param route :id(\\d+)', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/items/:id(\\d+)', method: 'GET' })] });
    expect(matchRoutes(ctrl, '/items/123', 'GET')).toBeDefined();
    expect(matchRoutes(ctrl, '/items/abc', 'GET')).toBeUndefined();
  });

  it('matches optional param route :name?', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users/:name?', method: 'GET' })] });
    expect(matchRoutes(ctrl, '/users', 'GET')).toBeDefined();
    expect(matchRoutes(ctrl, '/users/john', 'GET')).toBeDefined();
  });

  it('returns null when path is shorter than pattern (no optional)', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users/:id', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/users', 'GET');
    expect(result).toBeUndefined();
  });

  it('returns null when extra segments remain', () => {
    const ctrl = makeController({ routes: [makeRoute({ route: '/users', method: 'GET' })] });
    const result = matchRoutes(ctrl, '/users/extra', 'GET');
    expect(result).toBeUndefined();
  });

  it('searches children controllers', () => {
    const child = makeController({ routes: [makeRoute({ route: '/child', method: 'GET' })] });
    const parent = makeController({ children: [child] });
    const result = matchRoutes(parent, '/child', 'GET');
    expect(result).toBeDefined();
  });

  it('sorts by specificity - longer route wins', () => {
    const ctrl = makeController({
      routes: [
        makeRoute({ route: '/users', method: 'GET' }),
        makeRoute({ route: '/users/:id', method: 'GET' }),
      ],
    });
    const result = matchRoutes(ctrl, '/users/42', 'GET');
    expect(result!.route).toBe('/users/:id');
  });

  it('sorts - non-wildcard wins over wildcard when both match', () => {
    const ctrl = makeController({
      routes: [
        makeRoute({ route: '/files/specific', method: 'GET' }),
        makeRoute({ route: '/files/*', method: 'GET' }),
      ],
    });
    const result = matchRoutes(ctrl, '/files/specific', 'GET');
    expect(result!.route).toBe('/files/specific');
  });
});
