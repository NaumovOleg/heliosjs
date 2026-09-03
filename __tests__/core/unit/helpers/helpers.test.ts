import { describe, expect, it } from 'vitest';
import { matchRoutes, reflectMiddlewaresMetadata, reflectRouteMetadata, reflectControllerMeta, defineMiddlewaresMeta, defineRouteMeta, defineControllerMeta, generateUniqueId } from '@heliosjs/core/utils';
import { HTTP_METHODS } from '@heliosjs/core';
import { makeControllerMeta, makeRoute } from '../../../helpers/http';

describe('matchRoutes (extended)', () => {
  const meta = (routes: any[]) => makeControllerMeta({ routes });

  it('matches a static route', () => {
    const r = makeRoute({ route: '/users', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users', 'GET')).toBe(r);
  });

  it('matches param route', () => {
    const r = makeRoute({ route: '/users/:id', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users/5', 'GET')).toBe(r);
  });

  it('matches wildcard route', () => {
    const r = makeRoute({ route: '/files/*', method: 'GET' });
    expect(matchRoutes(meta([r]), '/files/a/b', 'GET')).toBe(r);
  });

  it('does not match different method', () => {
    const r = makeRoute({ route: '/users', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users', 'POST')).toBeUndefined();
  });

  it('matches ANY method', () => {
    const r = makeRoute({ route: '/x', method: 'ANY' });
    expect(matchRoutes(meta([r]), '/x', 'DELETE')).toBe(r);
  });

  it('returns undefined for no match', () => {
    const r = makeRoute({ route: '/users', method: 'GET' });
    expect(matchRoutes(meta([r]), '/nope', 'GET')).toBeUndefined();
  });

  it('first route wins (declaration order)', () => {
    const wildcard = makeRoute({ route: '/*', method: 'GET', name: 'wild' });
    const specific = makeRoute({ route: '/users', method: 'GET', name: 'specific' });
    expect(matchRoutes(meta([wildcard, specific]), '/users', 'GET')).toBe(wildcard);
  });

  it('matches regex param route', () => {
    const r = makeRoute({ route: '/users/:id(\\d+)', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users/123', 'GET')).toBe(r);
    expect(matchRoutes(meta([r]), '/users/abc', 'GET')).toBeUndefined();
  });

  it('matches optional param', () => {
    const r = makeRoute({ route: '/users/:id?', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users', 'GET')).toBe(r);
    expect(matchRoutes(meta([r]), '/users/5', 'GET')).toBe(r);
  });

  it('searches child controllers', () => {
    const childRoute = makeRoute({ route: '/posts', method: 'GET' });
    const child = makeControllerMeta({ routes: [childRoute] });
    const parent = makeControllerMeta({ routes: [], children: [child] });
    expect(matchRoutes(parent, '/posts', 'GET')).toBe(childRoute);
  });

  it('prefers longer route pattern', () => {
    const short = makeRoute({ route: '/users', method: 'GET', name: 'short' });
    const long = makeRoute({ route: '/users/list', method: 'GET', name: 'long' });
    expect(matchRoutes(meta([short, long]), '/users/list', 'GET')).toBe(long);
  });
});

describe('generateUniqueId', () => {
  it('returns a string', () => {
    const id = generateUniqueId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUniqueId()));
    expect(ids.size).toBe(100);
  });
});

describe('reflectControllerMeta', () => {
  it('returns empty meta for undecorated class', () => {
    class Foo {}
    const meta = reflectControllerMeta(Foo.prototype);
    expect(meta).toBeDefined();
    expect(meta.controllers).toEqual([]);
  });
});

describe('defineControllerMeta + reflectControllerMeta', () => {
  it('stores and retrieves controller meta', () => {
    class Foo {}
    defineControllerMeta({ name: 'Foo', prefix: '/foo' }, Foo.prototype);
    const meta = reflectControllerMeta(Foo.prototype);
    expect(meta.name).toBe('Foo');
    expect(meta.prefix).toBe('/foo');
  });

  it('merges with existing meta', () => {
    class Bar {}
    defineControllerMeta({ name: 'Bar' }, Bar.prototype);
    defineControllerMeta({ prefix: '/bar' }, Bar.prototype);
    const meta = reflectControllerMeta(Bar.prototype);
    expect(meta.name).toBe('Bar');
    expect(meta.prefix).toBe('/bar');
  });
});

describe('defineMiddlewaresMeta + reflectMiddlewaresMetadata', () => {
  it('stores and retrieves method-level middleware', () => {
    const target = { constructor: class {} };
    const fn = () => {};
    defineMiddlewaresMeta([{ middleware: fn }], target, 'handler');
    const result = reflectMiddlewaresMetadata(target, 'handler');
    expect(result.length).toBe(1);
    expect(result[0].middleware).toBe(fn);
  });

  it('stores and retrieves class-level middleware', () => {
    class Ctrl {}
    const fn = () => {};
    defineMiddlewaresMeta([{ middleware: fn }], Ctrl);
    const result = reflectMiddlewaresMetadata(Ctrl);
    expect(result.length).toBe(1);
  });

  it('prepends new items to existing', () => {
    const target = { constructor: class {} };
    const fn1 = () => {};
    const fn2 = () => {};
    defineMiddlewaresMeta([{ middleware: fn1 }], target, 'handler');
    defineMiddlewaresMeta([{ middleware: fn2 }], target, 'handler');
    const result = reflectMiddlewaresMetadata(target, 'handler');
    expect(result.length).toBe(2);
    expect(result[0].middleware).toBe(fn2);
    expect(result[1].middleware).toBe(fn1);
  });
});

describe('defineRouteMeta + reflectRouteMetadata', () => {
  it('stores and retrieves route metadata', () => {
    const target = { constructor: class {} };
    defineRouteMeta({ route: '/users', method: HTTP_METHODS.GET }, target, 'getUsers');
    const meta = reflectRouteMetadata(target, 'getUsers');
    expect(meta.route).toBe('/users');
    expect(meta.method).toBe('GET');
  });

  it('initializes parameters and middlewares arrays', () => {
    const target = { constructor: class {} };
    defineRouteMeta({ route: '/' }, target, 'index');
    const meta = reflectRouteMetadata(target, 'index');
    expect(Array.isArray(meta.parameters)).toBe(true);
    expect(Array.isArray(meta.middlewares)).toBe(true);
  });

  it('merges arrays', () => {
    const target = { constructor: class {} };
    defineRouteMeta({ route: '/a', parameters: [{ index: 0, type: 'body' }] }, target, 'handler');
    defineRouteMeta({ route: '/b', parameters: [{ index: 1, type: 'params' }] }, target, 'handler');
    const meta = reflectRouteMetadata(target, 'handler');
    expect(meta.route).toBe('/b');
    expect(meta.parameters.length).toBe(2);
  });
});
