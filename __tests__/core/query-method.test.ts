import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { HTTP_METHODS, Get, Query } from '@heliosjs/core';
import { matchRoutes, reflectRouteMetadata } from '@heliosjs/core/utils';
import { makeControllerMeta, makeRoute } from '../helpers/http';

const meta = (routes: any[]) => makeControllerMeta({ routes });

describe('@Query endpoint decorator', () => {
  class SearchController {
    @Query('/search')
    search() {}

    @Get('/search')
    get() {}
  }

  it('registers the route with the QUERY http method', () => {
    const route = reflectRouteMetadata(SearchController.prototype, 'search');
    expect(route.method).toBe(HTTP_METHODS.QUERY);
    expect(route.route).toBe('/search');
  });

  it('does not collide with a GET route on the same path', () => {
    const get = reflectRouteMetadata(SearchController.prototype, 'get');
    expect(get.method).toBe(HTTP_METHODS.GET);
  });
});

describe('matchRoutes with QUERY', () => {
  it('matches a QUERY request to a QUERY route', () => {
    const r = makeRoute({ route: '/search', method: 'QUERY' });
    expect(matchRoutes(meta([r]), '/search', 'QUERY')).toBe(r);
  });

  it('does not match a QUERY request to a GET route on the same path', () => {
    const r = makeRoute({ route: '/search', method: 'GET' });
    expect(matchRoutes(meta([r]), '/search', 'QUERY')).toBeUndefined();
  });

  it('matches a QUERY request against an ANY route', () => {
    const r = makeRoute({ route: '/search', method: 'ANY' });
    expect(matchRoutes(meta([r]), '/search', 'QUERY')).toBe(r);
  });
});
