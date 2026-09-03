import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { execute } from '../../../src/core/src/utils/core/controller';
import { matchRoutes } from '../../../src/core/src/utils/core/match';
import { Controller } from '../../../src/core/src/Controller';
import { ForbiddenError, NotFoundError, RateLimitExceededError, UnauthorizedError } from '../../../src/core/src/utils/core/error';
import type { ControllerMeta, Request, Response, Route } from '../../../src/core/src/types/core';

function makeReq(overrides: Record<string, any> = {}): Request {
  const base: Request = {
    method: 'GET', path: '/', url: '/', requestUrl: new URL('http://localhost/'),
    headers: {}, query: {}, body: undefined, params: {},
    cookies: {}, sourceIp: '127.0.0.1', userAgent: 'test', requestId: 'req-1', stage: 'dev',
    timestamp: new Date(), source: 'http', raw: {}, isBase64Encoded: false,
    setState: vi.fn(), getState: vi.fn(),
    getFullUrl: () => 'http://localhost/',
    getClientIp: () => '127.0.0.1',
    isSecure: () => false,
    isBase64Encoded: false,
    clone: vi.fn().mockReturnThis(),
    toJSON: vi.fn().mockReturnValue({}),
  };
  return { ...base, ...overrides } as unknown as Request;
}

function makeRes(): Response {
  const res: any = {
    data: undefined,
    status: 200,
    headersSent: false,
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    source: 'http',
    raw: { end: vi.fn(), setHeader: vi.fn(), removeHeader: vi.fn(), headersSent: false, statusCode: 200 },
    isRedirect: false,
    ok: true,
    meta: { requestUrl: new URL('http://localhost/'), method: 'GET' },
    getStatus: vi.fn().mockReturnValue(200),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue(undefined),
    hasHeader: vi.fn().mockReturnValue(false),
    removeHeader: vi.fn().mockReturnThis(),
    setHeaders: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    getCookies: vi.fn().mockReturnValue([]),
    redirect: vi.fn().mockReturnThis(),
    end: vi.fn(),
    reset: vi.fn().mockReturnThis(),
    toJSON: vi.fn().mockReturnValue({}),
  };
  res.error = vi.fn().mockImplementation(function (this: any, err: any) {
    res.status = err?.status ?? 500;
    res.data = err;
    return res;
  });
  return res as Response;
}

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    route: '/test', method: 'GET', name: 'testHandler',
    fn: vi.fn().mockReturnValue({ ok: true }),
    parameters: [], functions: [], cors: undefined,
    ...overrides,
  } as unknown as Route;
}

describe('matchRoutes - wildcard sorting (sort comparator coverage)', () => {
  it('sorts wildcard routes after non-wildcard when routes come from different children', () => {
    const child1: ControllerMeta = {
      prefix: '/api',
      routes: [{ route: '/api/users/:id', method: 'GET' } as Route],
      children: [],
      name: 'Child1',
      functions: [],
      controllers: [],
    };
    const child2: ControllerMeta = {
      prefix: '/api',
      routes: [{ route: '/api/*', method: 'GET' } as Route],
      children: [],
      name: 'Child2',
      functions: [],
      controllers: [],
    };
    const controller: ControllerMeta = {
      prefix: '',
      routes: [],
      children: [child1, child2],
      name: 'Parent',
      functions: [],
      controllers: [],
    };
    const result = matchRoutes(controller, '/api/users/42', 'GET');
    expect(result?.route).toBe('/api/users/:id');
  });

  it('sorts by route length when both non-wildcard, from different children', () => {
    const child1: ControllerMeta = {
      prefix: '/api',
      routes: [{ route: '/api/u', method: 'GET' } as Route],
      children: [],
      name: 'Child1',
      functions: [],
      controllers: [],
    };
    const child2: ControllerMeta = {
      prefix: '/api',
      routes: [{ route: '/api/users/long', method: 'GET' } as Route],
      children: [],
      name: 'Child2',
      functions: [],
      controllers: [],
    };
    const controller: ControllerMeta = {
      prefix: '',
      routes: [],
      children: [child1, child2],
      name: 'Parent',
      functions: [],
      controllers: [],
    };
    const result = matchRoutes(controller, '/api/users/long', 'GET');
    expect(result?.route).toBe('/api/users/long');
  });

  it('searches in nested children', () => {
    const grandchild: ControllerMeta = {
      prefix: '/api/v1',
      routes: [{ route: '/api/v1/items', method: 'GET' } as Route],
      children: [],
      name: 'Grandchild',
      functions: [],
      controllers: [],
    };
    const child: ControllerMeta = {
      prefix: '/api',
      routes: [],
      children: [grandchild],
      name: 'Child',
      functions: [],
      controllers: [],
    };
    const controller: ControllerMeta = {
      prefix: '',
      routes: [],
      children: [child],
      name: 'Parent',
      functions: [],
      controllers: [],
    };
    const result = matchRoutes(controller, '/api/v1/items', 'GET');
    expect(result?.route).toBe('/api/v1/items');
  });
});

describe('execute - error code known-list paths', () => {
  it('handles ForbiddenError (code in known list)', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new ForbiddenError('no access'); }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.status).toBe(403);
  });

  it('handles NotFoundError', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new NotFoundError('/missing'); }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.status).toBe(404);
  });

  it('handles RateLimitExceededError', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new RateLimitExceededError('slow down'); }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.status).toBe(429);
  });

  it('handles UnauthorizedError', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new UnauthorizedError('bad auth'); }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.status).toBe(401);
  });

  it('string error thrown - not instanceof Error, response not set', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw 'string boom'; }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result).toBe(res);
  });

  it('non-Error object thrown - no errorHandler, not instanceof Error, returns response', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw { code: 'CUSTOM', message: 'custom err' }; }),
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result).toBe(res);
  });

  it('errorHandler that catches and returns non-Error', async () => {
    const errorHandler = vi.fn().mockReturnValue({ recovered: true });
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      functions: [{ errorHandler }],
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.data).toEqual({ recovered: true });
  });

  it('errorHandler that throws is caught and chain continues', async () => {
    const badHandler = vi.fn().mockImplementation(() => { throw new Error('handler err'); });
    const goodHandler = vi.fn().mockReturnValue('recovered');
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      functions: [{ errorHandler: badHandler }, { errorHandler: goodHandler }],
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.data).toBe('recovered');
  });

  it('errorHandler returns Error - chain continues to next', async () => {
    const handler1 = vi.fn().mockReturnValue(new Error('still broken'));
    const handler2 = vi.fn().mockReturnValue('fixed');
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      functions: [{ errorHandler: handler1 }, { errorHandler: handler2 }],
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(result.data).toBe('fixed');
  });

  it('all errorHandlers return Error - final error response', async () => {
    const handler1 = vi.fn().mockReturnValue(new Error('still broken'));
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      functions: [{ errorHandler: handler1 }],
    });
    const req = makeReq();
    const res = makeRes();
    const result = await execute(route, req, res);
    expect(res.error).toHaveBeenCalled();
    expect(result.status).toBe(500);
  });
});

describe('Controller decorator - validation paths', () => {
  it('throws TypeError for invalid middlewares', () => {
    expect(() => {
      const decorator = Controller('/test', ['not-a-function' as any]);
      class Bad {}
      decorator(Bad);
    }).toThrow('Invalid middlewares');
  });

  it('throws TypeError for invalid sub-controllers', () => {
    expect(() => {
      const decorator = Controller({ prefix: '/test', controllers: ['bad' as any] });
      class Bad {}
      decorator(Bad);
    }).toThrow('Invalid sub-controllers');
  });
});
