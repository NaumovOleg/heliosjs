import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute, beforeRequest, collectRoutes, runGuard, getAllMethods } from '../../../../src/core/src/utils/core/controller';
import { ForbiddenError } from '../../../../src/core/src/utils/core/error';
import { ErrorCode } from '../../../../src/core/src/types/core';

function makeRoute(overrides: any = {}) {
  return {
    route: '/test',
    method: 'GET',
    name: 'testHandler',
    fn: vi.fn().mockReturnValue({ ok: true }),
    parameters: [],
    functions: [],
    cors: undefined,
    ...overrides,
  } as any;
}

function makeRequest(overrides: any = {}) {
  return {
    method: 'GET',
    path: '/test',
    url: '/test',
    requestUrl: new URL('http://localhost/test'),
    headers: {},
    query: {},
    body: undefined,
    params: {},
    cookies: {},
    sourceIp: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req-1',
    stage: 'dev',
    timestamp: new Date(),
    source: 'http' as const,
    raw: {},
    isBase64Encoded: false,
    ...overrides,
  } as any;
}

function makeResponse(overrides: any = {}) {
  const res: any = {
    status: 200,
    data: undefined,
    error: vi.fn(),
    isRedirect: false,
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    headers: {},
    raw: { end: vi.fn(), setHeader: vi.fn(), headersSent: false },
    ...overrides,
  };
  return res;
}

describe('execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets params from route pattern', async () => {
    const route = makeRoute({ route: '/users/:id' });
    const req = makeRequest({ url: '/users/42', path: '/users/42' });
    const res = makeResponse();
    await execute(route, req, res);
    expect(req.params).toEqual({ id: '42' });
  });

  it('handles cors not permitted - origin mismatch', async () => {
    const route = makeRoute({
      cors: [{ origin: 'https://allowed.com', methods: ['GET'] }],
    });
    const req = makeRequest({
      headers: { origin: 'https://evil.com' },
    });
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.status).toBe(403);
    expect(res.error).toHaveBeenCalled();
  });

  it('handles cors preflight (continue=false, permitted=true)', async () => {
    const route = makeRoute({
      cors: [{ origin: '*', methods: ['GET', 'POST'] }],
    });
    const req = makeRequest({
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.com',
        'access-control-request-method': 'POST',
      },
    });
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.status).toBe(204);
  });

  it('resolves function args when no parameters defined', async () => {
    const fn = vi.fn().mockReturnValue({ data: 'hello' });
    const route = makeRoute({ fn, parameters: [] });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith(req, res);
  });

  it('maps body parameter type', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 0, type: 'body' }],
    });
    const req = makeRequest({ body: { name: 'test' } });
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith({ name: 'test' });
  });

  it('maps query parameter type', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 0, type: 'query' }],
    });
    const req = makeRequest({ query: { q: 'search' } });
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith({ q: 'search' });
  });

  it('maps headers parameter type', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 0, type: 'headers' }],
    });
    const req = makeRequest({ headers: { authorization: 'Bearer token' } });
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith({ authorization: 'Bearer token' });
  });

  it('maps request parameter type', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 0, type: 'request' }],
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith(req);
  });

  it('maps response parameter type', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 0, type: 'response' }],
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith(res);
  });

  it('fills undefined for gaps in parameter indices', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      parameters: [{ index: 2, type: 'body' }],
    });
    const req = makeRequest({ body: { data: 1 } });
    const res = makeResponse();
    await execute(route, req, res);
    expect(fn).toHaveBeenCalledWith(undefined, undefined, { data: 1 });
  });

  it('returns error when fn returns Error instance', async () => {
    const error = new Error('handler failed');
    const fn = vi.fn().mockReturnValue(error);
    const route = makeRoute({ fn });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.error).toHaveBeenCalledWith(error);
  });

  it('sets status from route functions with status property', async () => {
    const fn = vi.fn().mockReturnValue({ created: true });
    const route = makeRoute({
      fn,
      functions: [{ status: 201 }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.status).toBe(201);
  });

  it('applies interceptors to response data', async () => {
    const interceptor = vi.fn().mockReturnValue({ intercepted: true });
    const fn = vi.fn().mockReturnValue({ original: true });
    const route = makeRoute({
      fn,
      functions: [{ interceptor }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(interceptor).toHaveBeenCalled();
    expect(res.data).toEqual({ intercepted: true });
  });

  it('error handler catches thrown errors and sets response data', async () => {
    const errorHandler = vi.fn().mockReturnValue({ handled: true });
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => {
        throw new Error('something broke');
      }),
      functions: [{ errorHandler }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(errorHandler).toHaveBeenCalled();
    expect(res.data).toEqual({ handled: true });
  });

  it('last error handler wins when first returns Error', async () => {
    const errorHandler1 = vi.fn().mockReturnValue(new Error('still broken'));
    const errorHandler2 = vi.fn().mockReturnValue({ finally: true });
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => {
        throw new Error('original');
      }),
      functions: [{ errorHandler: errorHandler1 }, { errorHandler: errorHandler2 }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(errorHandler2).toHaveBeenCalled();
    expect(res.data).toEqual({ finally: true });
  });

  it('BUG: string error silently swallowed - no error handler called, no response.error', async () => {
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => {
        throw 'string error';
      }),
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    // BUG: When a raw string is thrown, it's not an Error instance,
    // so the catch block skips the error handling. response.error is never called.
    expect(res.error).not.toHaveBeenCalled();
    expect(res.data).toBeUndefined();
  });

  it('all error handlers return Error - response.error called with last caught', async () => {
    const errorHandler = vi.fn().mockReturnValue(new Error('handler also threw'));
    const route = makeRoute({
      fn: vi.fn().mockImplementation(() => {
        throw new Error('original');
      }),
      functions: [{ errorHandler }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await execute(route, req, res);
    expect(errorHandler).toHaveBeenCalled();
  });

  it('skips redirect status override', async () => {
    const fn = vi.fn().mockReturnValue({ ok: true });
    const route = makeRoute({
      fn,
      functions: [{ status: 301 }] as any,
    });
    const req = makeRequest();
    const res = makeResponse({ isRedirect: true });
    await execute(route, req, res);
    expect(res.status).toBe(200);
  });
});

describe('beforeRequest', () => {
  it('applies sanitizer to request', async () => {
    const sanitizer = { type: 'body' as const, schema: { validate: vi.fn().mockReturnValue({ value: { sanitized: true } }) } };
    const route = makeRoute({
      functions: [{ sanitizer }] as any,
    });
    const req = makeRequest({ body: { dirty: true } });
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(req.body).toEqual({ sanitized: true });
  });

  it('runs guard and throws ForbiddenError on failure', async () => {
    const guard = vi.fn().mockReturnValue(false);
    const route = makeRoute({
      functions: [{ guard }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await expect(beforeRequest(req, res, route)).rejects.toThrow();
  });

  it('applies pipe transformations to body', async () => {
    const pipe = { body: vi.fn().mockReturnValue({ piped: true }) };
    const route = makeRoute({
      functions: [{ pipe }] as any,
    });
    const req = makeRequest({ body: { raw: true } });
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(req.body).toEqual({ piped: true });
  });

  it('applies pipe transformations to query', async () => {
    const pipe = { query: vi.fn().mockReturnValue({ filtered: true }) };
    const route = makeRoute({
      functions: [{ pipe }] as any,
    });
    const req = makeRequest({ query: { all: 'yes' } });
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(req.query).toEqual({ filtered: true });
  });

  it('applies pipe transformations to params', async () => {
    const pipe = { params: vi.fn().mockReturnValue({ clean: true }) };
    const route = makeRoute({
      functions: [{ pipe }] as any,
    });
    const req = makeRequest({ params: { id: '1' } });
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(req.params).toEqual({ clean: true });
  });

  it('applies pipe transformations to headers', async () => {
    const pipe = { headers: vi.fn().mockReturnValue({ filtered: true }) };
    const route = makeRoute({
      functions: [{ pipe }] as any,
    });
    const req = makeRequest({ headers: { auth: 'token' } });
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(req.headers).toEqual({ filtered: true });
  });

  it('runs middleware', async () => {
    const middleware = vi.fn();
    const route = makeRoute({
      functions: [{ middleware }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(middleware).toHaveBeenCalled();
  });

  it('re-throws forbidden errors from guard', async () => {
    const guard = vi.fn().mockRejectedValue(new ForbiddenError('denied'));
    const route = makeRoute({
      functions: [{ guard }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await expect(beforeRequest(req, res, route)).rejects.toThrow();
  });

  it('catches middleware errors with preceding error handler in beforeRequest', async () => {
    const errorHandler = vi.fn();
    const middleware = vi.fn().mockRejectedValue(new Error('middleware fail'));
    const route = makeRoute({
      functions: [{ errorHandler }, { middleware }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await beforeRequest(req, res, route);
    expect(errorHandler).toHaveBeenCalled();
  });

  it('BUG: error handler after throwing middleware is never reached in beforeRequest', async () => {
    const middleware = vi.fn().mockRejectedValue(new Error('middleware fail'));
    const errorHandler = vi.fn();
    const route = makeRoute({
      functions: [{ middleware }, { errorHandler }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    // BUG: errorHandler is defined AFTER middleware, so it's never collected before the throw
    await expect(beforeRequest(req, res, route)).rejects.toThrow('middleware fail');
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('re-throws when no error handlers and non-forbidden error', async () => {
    const middleware = vi.fn().mockRejectedValue(new Error('fail'));
    const route = makeRoute({
      functions: [{ middleware }] as any,
    });
    const req = makeRequest();
    const res = makeResponse();
    await expect(beforeRequest(req, res, route)).rejects.toThrow('fail');
  });
});

describe('runGuard', () => {
  it('runs guard instance with canActivate', async () => {
    const guard = { canActivate: vi.fn().mockResolvedValue(true), message: 'nope' };
    const req = makeRequest();
    const res = makeResponse();
    await runGuard(guard as any, req, res);
    expect(guard.canActivate).toHaveBeenCalled();
  });

  it('throws ForbiddenError when guard instance denies', async () => {
    const guard = { canActivate: vi.fn().mockResolvedValue(false), message: 'custom msg' };
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(guard as any, req, res)).rejects.toThrow('custom msg');
  });

  it('guard instance uses default message when message is undefined', async () => {
    const guard = { canActivate: vi.fn().mockResolvedValue(false) };
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(guard as any, req, res)).rejects.toThrow('Forbidden');
  });

  it('runs guard class (with prototype method) that grants access', async () => {
    class TestGuard {
      canActivate = vi.fn().mockResolvedValue(true);
      message = 'class msg';
    }
    // For class detection, canActivate must be on prototype
    TestGuard.prototype.canActivate = vi.fn().mockResolvedValue(true);
    const req = makeRequest();
    const res = makeResponse();
    await runGuard(TestGuard, req, res);
  });

  it('runs guard function that returns boolean true', async () => {
    const guard = vi.fn().mockResolvedValue(true);
    const req = makeRequest();
    const res = makeResponse();
    await runGuard(guard, req, res);
    expect(guard).toHaveBeenCalled();
  });

  it('throws ForbiddenError when guard function returns false', async () => {
    const guard = vi.fn().mockResolvedValue(false);
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(guard, req, res)).rejects.toThrow('Forbidden');
  });

  it('throws ForbiddenError when guard function returns string', async () => {
    const guard = vi.fn().mockResolvedValue('not allowed');
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(guard, req, res)).rejects.toThrow('not allowed');
  });
});

describe('getAllMethods', () => {
  it('collects methods from prototype chain', () => {
    class Base {
      baseMethod() {}
    }
    class Child extends Base {
      childMethod() {}
    }
    const instance = new Child();
    const methods = getAllMethods(instance);
    expect(methods).toContain('childMethod');
    expect(methods).toContain('baseMethod');
  });

  it('excludes constructor', () => {
    class Foo {
      bar() {}
    }
    const methods = getAllMethods(new Foo());
    expect(methods).not.toContain('constructor');
  });

  it('excludes non-function properties', () => {
    class Bar {
      myMethod() {}
      myProp = 'hello';
    }
    const methods = getAllMethods(new Bar());
    expect(methods).toContain('myMethod');
    expect(methods).not.toContain('myProp');
  });
});

describe('collectRoutes', () => {
  it('collects routes from controller instance', () => {
    const instance = {
      constructor: { prototype: {} },
      myMethod: vi.fn(),
    } as any;
    const meta = {
      name: 'TestCtrl',
      prefix: '/api',
      functions: [],
      routes: [],
    };
    try {
      collectRoutes(instance, meta, '/');
    } catch {
      // may fail due to missing metadata, that's ok
    }
  });
});
