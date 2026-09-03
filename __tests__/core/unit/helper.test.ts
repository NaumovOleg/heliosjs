import { describe, expect, it } from 'vitest';
import {
  normalizePath,
  getParams,
  buildRoutePattern,
  isClass,
  extractMiddlewares,
  mergeMiddlewares,
  mergeInterceptors,
} from '../../../src/core/src/utils/core/helper';

describe('normalizePath', () => {
  it('returns / for empty string', () => {
    expect(normalizePath('')).toBe('/');
  });

  it('returns / for falsy value', () => {
    expect(normalizePath(undefined as any)).toBe('/');
  });

  it('strips query string', () => {
    expect(normalizePath('/users?page=1&limit=10')).toBe('/users');
  });

  it('normalizes leading and trailing slashes', () => {
    expect(normalizePath('//users/')).toBe('/users');
  });

  it('preserves inner slashes', () => {
    expect(normalizePath('/users/123/posts')).toBe('/users/123/posts');
  });

  it('handles root path with query', () => {
    expect(normalizePath('/?foo=bar')).toBe('/');
  });

  it('returns / for just /', () => {
    expect(normalizePath('/')).toBe('/');
  });
});

describe('getParams', () => {
  it('extracts named params', () => {
    expect(getParams('/users/:id', '/users/42')).toEqual({ id: '42' });
  });

  it('extracts multiple params', () => {
    expect(getParams('/users/:userId/posts/:postId', '/users/1/posts/99')).toEqual({
      userId: '1',
      postId: '99',
    });
  });

  it('returns empty object for non-matching static paths', () => {
    expect(getParams('/users', '/posts')).toEqual({});
  });

  it('returns empty object when segment count differs', () => {
    expect(getParams('/users', '/users/1')).toEqual({});
  });

  it('matches static segments', () => {
    expect(getParams('/users/list', '/users/list')).toEqual({});
  });

  it('returns empty object when static segment mismatches', () => {
    expect(getParams('/users/detail', '/users/list')).toEqual({});
  });

  it('handles wildcard routes', () => {
    expect(getParams('/files/*', '/files/a/b/c')).toEqual({ '*': 'a/b/c' });
  });

  it('wildcard with no extra segments returns empty string for *', () => {
    expect(getParams('/files/*', '/files/')).toEqual({ '*': '' });
  });

  it('returns empty object when wildcard path has fewer segments than pattern', () => {
    expect(getParams('/a/b/*', '/a')).toEqual({});
  });

  it('handles root pattern with param', () => {
    expect(getParams('/:id', '/42')).toEqual({ id: '42' });
  });

  it('handles query string in actual path', () => {
    expect(getParams('/users/:id', '/users/5?page=1')).toEqual({ id: '5' });
  });
});

describe('buildRoutePattern', () => {
  it('joins parts with /', () => {
    expect(buildRoutePattern(['users', 'list'])).toBe('users/list');
  });

  it('filters empty/falsy parts', () => {
    expect(buildRoutePattern(['users', '', 'list', undefined as any])).toBe('users/list');
  });

  it('collapses double slashes', () => {
    expect(buildRoutePattern(['users//', '/list'])).toBe('users/list');
  });

  it('returns empty string for empty array', () => {
    expect(buildRoutePattern([])).toBe('');
  });
});

describe('isClass', () => {
  it('returns true for class declarations', () => {
    class Foo {}
    expect(isClass(Foo)).toBe(true);
  });

  it('returns true for anonymous classes', () => {
    expect(isClass(class {})).toBe(true);
  });

  it('returns false for functions', () => {
    expect(isClass(() => {})).toBe(false);
  });

  it('returns false for arrow functions', () => {
    const fn = () => {};
    expect(isClass(fn)).toBe(false);
  });

  it('returns false for non-functions', () => {
    expect(isClass('class Foo {}')).toBe(false);
    expect(isClass(42)).toBe(false);
    expect(isClass(null)).toBe(false);
    expect(isClass(undefined)).toBe(false);
  });
});

describe('extractMiddlewares', () => {
  it('filters and maps middleware items by type', () => {
    const mw = () => {};
    const items = [{ middleware: mw }, { guard: () => true }, { middleware: () => {} }];
    const result = extractMiddlewares(items as any, 'middleware');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(mw);
  });

  it('returns empty array when no matches', () => {
    const items = [{ guard: () => true }];
    const result = extractMiddlewares(items as any, 'middleware');
    expect(result).toEqual([]);
  });

  it('handles empty input', () => {
    expect(extractMiddlewares([], 'middleware')).toEqual([]);
  });

  it('filters out falsy values after mapping', () => {
    const items = [{ middleware: undefined }, { middleware: () => {} }];
    const result = extractMiddlewares(items as any, 'middleware');
    expect(result).toHaveLength(1);
  });
});

describe('mergeMiddlewares', () => {
  it('flattens multiple arrays', () => {
    const a = [() => {}];
    const b = [() => {}, () => {}];
    expect(mergeMiddlewares(a, b)).toHaveLength(3);
  });

  it('handles empty arrays', () => {
    expect(mergeMiddlewares([], [])).toEqual([]);
  });
});

describe('mergeInterceptors', () => {
  it('flattens multiple arrays', () => {
    const a = [async () => {}];
    const b = [async () => {}, async () => {}];
    expect(mergeInterceptors(a, b)).toHaveLength(3);
  });
});
