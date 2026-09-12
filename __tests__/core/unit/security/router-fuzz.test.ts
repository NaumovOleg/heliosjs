import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller, Get } from '@heliosjs/core';
import { findRoute } from '@heliosjs/core/utils';
import { CONTROLLER_PRECOMPILED } from '@heliosjs/core/constants';

// Adversarial-input corpus for the router, not a random fuzzer (see the
// plan doc's reasoning: a curated corpus of known attack/edge shapes is
// simpler than pulling in a property-based-testing dependency for a router
// this size, and covers the same well-known cases a security review would
// check by hand). Every one of these must, at minimum, not throw and not
// hang; several assert the *specific* expected outcome too.
const ADVERSARIAL_PATHS = [
  // Path traversal attempts — the router must not treat ".." as filesystem
  // navigation; it's just another path segment to the segment/regex matcher.
  '/users/../admin',
  '/../../etc/passwd',
  '/users/..%2f..%2fadmin',
  '/users/....//admin',
  // Double / empty segments
  '//users',
  '/users//1',
  '///',
  '',
  '/',
  // Null bytes and control characters
  '/users/\x00',
  '/users/1\x00/../admin',
  '/users/\t1',
  '/users/\n1',
  // Very long path (would be the shape that trips a catastrophic-backtracking
  // regex, if the framework's own generated patterns had one)
  '/users/' + 'a'.repeat(50_000),
  '/' + 'a/'.repeat(10_000) + 'users',
  // Unicode / homoglyphs
  '/üsers/1',
  '/users/Ⅰ',
  '/users/​1', // zero-width space
  // Regex-special characters a naive implementation might mishandle
  '/users/(.*)$',
  '/users/[a-z]+',
  '/users/$1',
  '/users/\\',
  '/users/.*',
  '/users/^$',
] as const;

describe('router fuzzing (adversarial path corpus)', () => {
  @Controller('/users')
  class UsersController {
    @Get('/')
    list() {
      return [];
    }
    @Get('/:id')
    getOne() {
      return {};
    }
  }

  @Controller('/files')
  class FilesController {
    @Get('/*')
    serve() {
      return {};
    }
  }

  @Controller('/search')
  class SearchController {
    @Get('/:q?')
    search() {
      return {};
    }
  }

  @Controller('/orders')
  class OrdersController {
    @Get('/:id(\\d+)')
    getOne() {
      return {};
    }
  }

  const root = { prefix: '/', name: 'root', functions: [], routes: [], controllers: [] };
  const usersInstance = new UsersController(root as never) as unknown as {
    [CONTROLLER_PRECOMPILED]: never;
  };
  const filesInstance = new FilesController(root as never) as unknown as {
    [CONTROLLER_PRECOMPILED]: never;
  };
  const searchInstance = new SearchController(root as never) as unknown as {
    [CONTROLLER_PRECOMPILED]: never;
  };
  const ordersInstance = new OrdersController(root as never) as unknown as {
    [CONTROLLER_PRECOMPILED]: never;
  };

  it.each(ADVERSARIAL_PATHS)('never throws or hangs on %j', (path) => {
    expect(() => findRoute(usersInstance[CONTROLLER_PRECOMPILED], path, 'GET')).not.toThrow();
    expect(() => findRoute(filesInstance[CONTROLLER_PRECOMPILED], path, 'GET')).not.toThrow();
    expect(() => findRoute(searchInstance[CONTROLLER_PRECOMPILED], path, 'GET')).not.toThrow();
  });

  it('a traversal attempt against a static route does not match it', () => {
    // `/users/../admin` has different segments than `/users` — the matcher
    // treats ".." as a literal path segment, not a filesystem "go up".
    expect(findRoute(usersInstance[CONTROLLER_PRECOMPILED], '/users/../admin', 'GET')).toBeUndefined();
  });

  it('a traversal attempt inside a wildcard route still matches the wildcard (by design — @Params("*") gets the raw remainder, same as everyone else)', () => {
    const match = findRoute(filesInstance[CONTROLLER_PRECOMPILED], '/files/../secret', 'GET');
    expect(match).toBeDefined();
    // The router doesn't resolve ".." — whatever reads @Params('*') to touch
    // the filesystem is responsible for its own path-safety check, same as
    // Express/Fastify's static-file middlewares are (this route has no
    // filesystem access here, it's a plain handler).
  });

  it('an extremely long path still resolves quickly (no catastrophic backtracking)', () => {
    const start = performance.now();
    findRoute(usersInstance[CONTROLLER_PRECOMPILED], '/users/' + 'a'.repeat(200_000), 'GET');
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('an inline-regex route (:id(\\d+)) also resolves quickly on a long adversarial segment', () => {
    // Regression guard for framework-*generated* patterns specifically (this
    // route's own `\d+` is safe by construction, unlike the user-supplied
    // pattern `looksReDoSRisky` warns about in redos.test.ts) — a long
    // non-matching segment must fail fast, not hang.
    const start = performance.now();
    const match = findRoute(
      ordersInstance[CONTROLLER_PRECOMPILED],
      '/orders/' + '1'.repeat(200_000) + 'x', // long digit run, then a non-digit -> no match
      'GET'
    );
    expect(performance.now() - start).toBeLessThan(200);
    expect(match).toBeUndefined();
  });
});
