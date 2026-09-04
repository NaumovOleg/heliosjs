import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute, beforeRequest, runGuard } from '../../../src/core/src/utils/core/controller';
import { matchRoutes } from '../../../src/core/src/utils/core/match';
import { Endpoint, Get, Post, Any } from '../../../src/core/src/Endpoint';
import { HTTP_METHODS } from '../../../src/core/src/types/core';
import { TO_VALIDATE } from '../../../src/core/src/constants';
import type { Route, Request, Response, GuardInstance } from '../../../src/core/src/types/core';

function makeRoute(overrides: any = {}): Route {
  return {
    name: 'handler',
    route: '/',
    method: 'GET',
    parameters: [],
    functions: [],
    fn: vi.fn().mockReturnValue({ ok: true }),
    cors: undefined,
    ...overrides,
  } as unknown as Route;
}

function makeRequest(overrides: any = {}): Request {
  return {
    method: 'GET',
    path: '/',
    url: '/',
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
  } as unknown as Request;
}

function makeResponse(): Response {
  const res: any = {
    status: 200,
    data: undefined,
    error: vi.fn(),
    isRedirect: false,
    setHeader: vi.fn(),
    headers: {},
    raw: { end: vi.fn(), setHeader: vi.fn(), headersSent: false },
  };
  return res as unknown as Response;
}

function makeControllerMeta(overrides: any = {}) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #1: @Any() — не работает, всегда 404
// Any() → Endpoint(ANY, '/') → route path = api/
// extractParamsAndWildcard: паттерн ['api'] ≠ запрос ['api', 'anything']
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #1: @Any() catch-all route', () => {
  it('Any() decorator sets route to * for wildcard matching', () => {
    const meta = getRouteMeta(AnyTestCtrl.prototype, 'anyMethod');
    expect(meta.route).toBe('*');
    expect(meta.method).toBe('ANY');
  });

  it('ANY wildcard route matches any subpath', () => {
    const route = makeRoute({ route: '/api/*', method: 'ANY' });
    const meta = makeControllerMeta({ routes: [route] });

    expect(matchRoutes(meta, '/api/anything', 'GET')).toBe(route);
    expect(matchRoutes(meta, '/api/deep/nested/path', 'POST')).toBe(route);
    expect(matchRoutes(meta, '/api/', 'DELETE')).toBe(route);
  });

  it('ANY wildcard with prefix api/* matches api/anything', () => {
    const route = makeRoute({ route: '/api/*', method: 'ANY' });
    const meta = makeControllerMeta({ routes: [route] });

    expect(matchRoutes(meta, '/api/test', 'GET')).toBe(route);
  });
})

class AnyTestCtrl {
  @Any()
  anyMethod() {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #2: GET /api/status/204 — 500 "Cannot read properties of undefined"
// Handler возвращает undefined (void), interceptor вызывается с
// interceptor!(data, data.request, data.response) → data.request throws
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #2: handler returning undefined (void/204) with interceptors', () => {
  it('should not crash when handler returns undefined and interceptors exist', async () => {
    const interceptor = vi.fn().mockImplementation(async (data: any) => data);
    const route = makeRoute({
      route: '/status/204',
      fn: vi.fn().mockReturnValue(undefined),
      functions: [{ interceptor }],
    });
    const req = makeRequest({ path: '/status/204' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(res.data).toBeUndefined();
    expect(res.status).toBe(200);
  });

  it('should pass request/response to interceptor, not data.request/data.response', async () => {
    const interceptor = vi.fn().mockImplementation(async (data: any) => data);
    const route = makeRoute({
      route: '/test',
      fn: vi.fn().mockReturnValue({ hello: true }),
      functions: [{ interceptor }],
    });
    const req = makeRequest({ path: '/test' });
    const res = makeResponse();

    await execute(route, req, res);

    const [dataArg, reqArg, resArg] = interceptor.mock.calls[0];
    expect(dataArg).toEqual({ hello: true });
    expect(reqArg).toBe(req);
    expect(resArg).toBe(res);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #3: MessageGuard — не блокирует, пропускает request
// canActivate() возвращает строку (truthy) → !canActivate = false → guard passes
// Функциональные guards корректно обрабатывают string, но классовые — нет
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #3: class guard returning string message should block', () => {
  class MessageGuard implements GuardInstance {
    message = 'Custom deny message';
    canActivate() {
      return this.message;
    }
  }

  it('class guard returning string should throw ForbiddenError', async () => {
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(new MessageGuard(), req, res)).rejects.toThrow('Custom deny message');
  });

  it('function guard returning string should throw ForbiddenError', async () => {
    const guardFn = () => 'blocked by fn';
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(guardFn, req, res)).rejects.toThrow('blocked by fn');
  });

  it('class guard returning false should throw ForbiddenError', async () => {
    class BoolGuard implements GuardInstance {
      canActivate() { return false; }
    }
    const req = makeRequest();
    const res = makeResponse();
    await expect(runGuard(new BoolGuard(), req, res)).rejects.toThrow('Forbidden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #4: @Cookies("session") — возвращает все cookies вместо конкретного
// 'cookies' отсутствует в TO_VALIDATE → строка с param.name недостижима
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #4: cookies not in TO_VALIDATE', () => {
  it('cookies should be in TO_VALIDATE for @Cookies("session") to work', () => {
    expect(TO_VALIDATE).toContain('cookies');
  });

  it('all parameter types that support name-based extraction are in TO_VALIDATE', () => {
    expect(TO_VALIDATE).toContain('headers');
    expect(TO_VALIDATE).toContain('params');
    expect(TO_VALIDATE).toContain('query');
    expect(TO_VALIDATE).toContain('body');
    expect(TO_VALIDATE).toContain('cookies');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #5: chain/error-in-pipe — handler всё равно выполняется после throw из pipe
// beforeRequest ловит ошибку, делает return — но execute продолжает и вызывает handler
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #5: error in pipe should prevent handler execution', () => {
  it('pipe throw should prevent handler from running', async () => {
    const handler = vi.fn().mockReturnValue('nope');
    const pipeFn = vi.fn().mockImplementation(() => { throw new Error('pipe exploded'); });
    const errorHandler = vi.fn().mockImplementation(async (err: Error) => ({ caught: err.message }));

    const route = makeRoute({
      route: '/chain/error-in-pipe',
      fn: handler,
      functions: [
        { pipe: { body: pipeFn } },
        { errorHandler },
      ],
    });
    const req = makeRequest({ path: '/chain/error-in-pipe' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(pipeFn).toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(res.data).toEqual({ caught: 'pipe exploded' });
  });

  it('pipe throw with @Catch should return catch result', async () => {
    const handler = vi.fn().mockReturnValue('nope');
    const pipeFn = vi.fn().mockImplementation(() => { throw new Error('pipe exploded'); });
    const catchFn = vi.fn().mockImplementation((err: Error) => ({ caught: err.message }));

    const route = makeRoute({
      route: '/chain/error-in-pipe',
      fn: handler,
      functions: [
        { pipe: { body: pipeFn } },
        { errorHandler: catchFn },
      ],
    });
    const req = makeRequest({ path: '/chain/error-in-pipe' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.data).toEqual({ caught: 'pipe exploded' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #6: catch/bad-request — возвращает HTTP 200 вместо ошибки
// Handler возвращает { status: 400 } как обычный объект → @Catch не срабатывает
// Это design choice, не баг — framework не обрабатывает return objects с полем status
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #6: returning { status: 400 } object vs throwing', () => {
  it('returning { status: 400 } does NOT trigger error handling (design choice)', async () => {
    const handler = vi.fn().mockReturnValue({ status: 400, message: 'bad data' });
    const catchFn = vi.fn();

    const route = makeRoute({
      route: '/catch/bad-request',
      fn: handler,
      functions: [{ errorHandler: catchFn }],
    });
    const req = makeRequest({ path: '/catch/bad-request' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(catchFn).not.toHaveBeenCalled();
    expect(res.data).toEqual({ status: 400, message: 'bad data' });
    expect(res.status).toBe(200);
  });

  it('throwing Error triggers error handling', async () => {
    const handler = vi.fn().mockImplementation(() => { throw new Error('bad data'); });
    const catchFn = vi.fn().mockImplementation((err: Error) => ({ caught: err.message }));

    const route = makeRoute({
      route: '/catch/throw',
      fn: handler,
      functions: [{ errorHandler: catchFn }],
    });
    const req = makeRequest({ path: '/catch/throw' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(catchFn).toHaveBeenCalled();
    expect(res.data).toEqual({ caught: 'bad data' });
  });

  it('returning Error instance triggers error handling', async () => {
    const handler = vi.fn().mockReturnValue(new Error('bad data'));
    const catchFn = vi.fn();

    const route = makeRoute({
      route: '/catch/error-instance',
      fn: handler,
      functions: [{ errorHandler: catchFn }],
    });
    const req = makeRequest({ path: '/catch/error-instance' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(catchFn).not.toHaveBeenCalled();
    expect(res.error).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG #7: Interceptor получает undefined для request/response
// interceptor!(data, data.request, data.response) — data это результат handler
// Все interceptors логируют [INTERCEPT] before: undefined
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bug #7: interceptor receives undefined request/response', () => {
  it('interceptor should receive (data, request, response) not (data, data.request, data.response)', async () => {
    const interceptor = vi.fn().mockImplementation(async (data: any, req: any, res: any) => {
      return { intercepted: true, reqPath: req?.path, resStatus: res?.status };
    });
    const route = makeRoute({
      route: '/intercept/test',
      fn: vi.fn().mockReturnValue({ original: true }),
      functions: [{ interceptor }],
    });
    const req = makeRequest({ path: '/intercept/test' });
    const res = makeResponse();

    await execute(route, req, res);

    const [, reqArg, resArg] = interceptor.mock.calls[0];
    expect(reqArg).toBeDefined();
    expect(reqArg.path).toBe('/intercept/test');
    expect(resArg).toBeDefined();
    expect(resArg).toBe(res);
  });

  it('interceptor chain receives correct request/response at each step', async () => {
    const log: string[] = [];
    const i1 = vi.fn().mockImplementation(async (data: any, req: any) => {
      log.push(`i1:${req?.path}`);
      return data;
    });
    const i2 = vi.fn().mockImplementation(async (data: any, req: any) => {
      log.push(`i2:${req?.path}`);
      return { ...data, i2: true };
    });

    const route = makeRoute({
      route: '/intercept/chain',
      fn: vi.fn().mockReturnValue({ hello: true }),
      functions: [{ interceptor: i1 }, { interceptor: i2 }],
    });
    const req = makeRequest({ path: '/intercept/chain' });
    const res = makeResponse();

    await execute(route, req, res);

    expect(log).toEqual(['i2:/intercept/chain', 'i1:/intercept/chain']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Workflow tests for examples/src/controllers/api.ts patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('Api controller workflow patterns', () => {
  describe('GET endpoints', () => {
    it('GET /api/ping returns pong with query', async () => {
      const handler = vi.fn().mockImplementation((_req: any, _res: any) => ({ pong: true, query: _req.query }));
      const route = makeRoute({ route: '/api/ping', fn: handler, name: 'ping', parameters: [] });
      const req = makeRequest({ path: '/api/ping', query: { foo: 'bar' } });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).toHaveBeenCalled();
      expect(res.data).toEqual({ pong: true, query: { foo: 'bar' } });
    });

    it('GET /api/ping/:id extracts params', async () => {
      const handler = vi.fn().mockReturnValue({ pong: true });
      const route = makeRoute({ route: '/api/ping/:id', fn: handler, name: 'test' });
      const req = makeRequest({ path: '/api/ping/42' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(req.params).toEqual({ id: '42' });
    });

    it('GET /api/hello/:name returns personalized message', async () => {
      const handler = vi.fn().mockImplementation((name: string) => ({
        message: `Hello ${name}`,
      }));
      const route = makeRoute({
        route: '/api/hello/:name',
        fn: handler,
        name: 'helloName',
        parameters: [{ index: 0, type: 'params', name: 'name' }],
      });
      const req = makeRequest({ path: '/api/hello/world' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).toHaveBeenCalledWith('world');
      expect(res.data).toEqual({ message: 'Hello world' });
    });
  });

  describe('POST/PUT/PATCH/DELETE endpoints', () => {
    it('POST /api/echo returns body', async () => {
      const handler = vi.fn().mockImplementation((body: any) => body);
      const route = makeRoute({
        route: '/api/echo',
        fn: handler,
        method: 'POST',
        name: 'echo',
        parameters: [{ index: 0, type: 'body' }],
      });
      const req = makeRequest({ method: 'POST', path: '/api/echo', body: { data: 1 } });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ data: 1 });
    });

    it('PUT /api/update returns updated object', async () => {
      const handler = vi.fn().mockImplementation((body: any) => ({ updated: body }));
      const route = makeRoute({
        route: '/api/update',
        fn: handler,
        method: 'PUT',
        name: 'update',
        parameters: [{ index: 0, type: 'body' }],
      });
      const req = makeRequest({ method: 'PUT', path: '/api/update', body: { x: 1 } });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ updated: { x: 1 } });
    });

    it('DELETE /api/remove/:id extracts id param', async () => {
      const handler = vi.fn().mockImplementation((id: string) => ({ deleted: id }));
      const route = makeRoute({
        route: '/api/remove/:id',
        fn: handler,
        method: 'DELETE',
        name: 'remove',
        parameters: [{ index: 0, type: 'params', name: 'id' }],
      });
      const req = makeRequest({ method: 'DELETE', path: '/api/remove/99' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).toHaveBeenCalledWith('99');
      expect(res.data).toEqual({ deleted: '99' });
    });
  });

  describe('Guards', () => {
    it('TestGuard passes', async () => {
      class TestGuard implements GuardInstance {
        canActivate() { return true; }
      }
      const handler = vi.fn().mockReturnValue({ guard: 'passed' });
      const route = makeRoute({
        route: '/api/guard/test',
        fn: handler,
        functions: [{ guard: new TestGuard() }],
      });
      const req = makeRequest({ path: '/api/guard/test' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ guard: 'passed' });
    });

    it('BlockingGuard blocks', async () => {
      class BlockingGuard implements GuardInstance {
        canActivate() { return false; }
      }
      const handler = vi.fn().mockReturnValue({ guard: 'should not reach' });
      const route = makeRoute({
        route: '/api/guard/block',
        fn: handler,
        functions: [{ guard: new BlockingGuard() }],
      });
      const req = makeRequest({ path: '/api/guard/block' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res.error).toHaveBeenCalled();
    });

    it('function guard returning string blocks', async () => {
      const guardFn = () => 'blocked by function guard';
      const handler = vi.fn().mockReturnValue({ guardFn: 'should not reach' });
      const route = makeRoute({
        route: '/api/guard/fn-block',
        fn: handler,
        functions: [{ guard: guardFn }],
      });
      const req = makeRequest({ path: '/api/guard/fn-block' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res.error).toHaveBeenCalled();
    });
  });

  describe('Pipes', () => {
    it('trimPipe trims string values in body', async () => {
      const trimPipe = {
        body: (data: any) => {
          if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
              if (typeof data[key] === 'string') data[key] = data[key].trim();
            }
          }
          return data;
        },
      };
      const handler = vi.fn().mockImplementation((body: any) => ({ body }));
      const route = makeRoute({
        route: '/api/pipe/trim',
        fn: handler,
        method: 'POST',
        name: 'pipeTrim',
        functions: [{ pipe: trimPipe }],
        parameters: [{ index: 0, type: 'body' }],
      });
      const req = makeRequest({ method: 'POST', path: '/api/pipe/trim', body: { name: '  hello  ' } });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ body: { name: 'hello' } });
    });

    it('chained pipes apply in order', async () => {
      const trimPipe = {
        body: (data: any) => {
          if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
              if (typeof data[key] === 'string') data[key] = data[key].trim();
            }
          }
          return data;
        },
      };
      const upperCasePipe = {
        body: (data: any) => {
          if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
              if (typeof data[key] === 'string') data[key] = data[key].toUpperCase();
            }
          }
          return data;
        },
      };
      const handler = vi.fn().mockImplementation((body: any) => ({ body }));
      const route = makeRoute({
        route: '/api/pipe/chain',
        fn: handler,
        method: 'POST',
        name: 'pipeChain',
        functions: [{ pipe: trimPipe }, { pipe: upperCasePipe }],
        parameters: [{ index: 0, type: 'body' }],
      });
      const req = makeRequest({ method: 'POST', path: '/api/pipe/chain', body: { name: '  hello  ' } });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ body: { name: 'HELLO' } });
    });
  });

  describe('Interceptors', () => {
    it('logging interceptor receives data, request, response', async () => {
      const loggingInterceptor = vi.fn().mockImplementation(async (data: any) => data);
      const route = makeRoute({
        route: '/api/intercept/log',
        fn: vi.fn().mockReturnValue({ interceptor: 'log' }),
        functions: [{ interceptor: loggingInterceptor }],
      });
      const req = makeRequest({ path: '/api/intercept/log' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(loggingInterceptor).toHaveBeenCalledTimes(1);
      const [data, reqArg, resArg] = loggingInterceptor.mock.calls[0];
      expect(data).toEqual({ interceptor: 'log' });
      expect(reqArg).toBe(req);
      expect(resArg).toBe(res);
    });

    it('transform interceptor modifies data', async () => {
      const transformInterceptor = vi.fn().mockImplementation(async (data: any) => ({
        intercepted: true,
        original: data,
      }));
      const route = makeRoute({
        route: '/api/intercept/transform',
        fn: vi.fn().mockReturnValue({ interceptor: 'transform', value: 42 }),
        functions: [{ interceptor: transformInterceptor }],
      });
      const req = makeRequest({ path: '/api/intercept/transform' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({
        intercepted: true,
        original: { interceptor: 'transform', value: 42 },
      });
    });
  });

  describe('Error handling (Catch)', () => {
    it('catch/ok — no error, handler runs normally', async () => {
      const handler = vi.fn().mockReturnValue({ noError: true });
      const catchFn = vi.fn();
      const route = makeRoute({
        route: '/api/catch/ok',
        fn: handler,
        functions: [{ errorHandler: catchFn }],
      });
      const req = makeRequest({ path: '/api/catch/ok' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(catchFn).not.toHaveBeenCalled();
      expect(res.data).toEqual({ noError: true });
    });

    it('catch/throw — thrown error handled by catch', async () => {
      const handler = vi.fn().mockImplementation(() => { throw new Error('intentional error'); });
      const catchFn = vi.fn().mockImplementation((err: Error) => ({ caught: true, error: err.message }));
      const route = makeRoute({
        route: '/api/catch/throw',
        fn: handler,
        functions: [{ errorHandler: catchFn }],
      });
      const req = makeRequest({ path: '/api/catch/throw' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(catchFn).toHaveBeenCalled();
      expect(res.data).toEqual({ caught: true, error: 'intentional error' });
    });

    it('catch/not-found — NotFoundError returns error', async () => {
      const handler = vi.fn().mockReturnValue(new Error('resource not found'));
      const route = makeRoute({
        route: '/api/catch/not-found',
        fn: handler,
      });
      const req = makeRequest({ path: '/api/catch/not-found' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.error).toHaveBeenCalled();
    });
  });

  describe('Status codes', () => {
    it('status/200 with @Ok200', async () => {
      const route = makeRoute({
        route: '/api/status/200',
        fn: vi.fn().mockReturnValue({ status: 200 }),
        functions: [{ status: 200 }],
      });
      const req = makeRequest({ path: '/api/status/200' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.status).toBe(200);
    });

    it('status/201 with @Ok201', async () => {
      const route = makeRoute({
        route: '/api/status/201',
        fn: vi.fn().mockReturnValue({ status: 201 }),
        functions: [{ status: 201 }],
      });
      const req = makeRequest({ path: '/api/status/201' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.status).toBe(201);
    });

    it('status/204 returns undefined without crashing (Bug #2)', async () => {
      const route = makeRoute({
        route: '/api/status/204',
        fn: vi.fn().mockReturnValue(undefined),
        functions: [{ status: 204 }],
      });
      const req = makeRequest({ path: '/api/status/204' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.status).toBe(204);
      expect(res.data).toBeUndefined();
    });

    it('status/custom 418', async () => {
      const route = makeRoute({
        route: '/api/status/custom',
        fn: vi.fn().mockReturnValue({ status: 418 }),
        functions: [{ status: 418 }],
      });
      const req = makeRequest({ path: '/api/status/custom' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.status).toBe(418);
    });
  });

  describe('Middleware chains', () => {
    it('guard + pipe + catch chain', async () => {
      class TestGuard implements GuardInstance {
        canActivate() { return true; }
      }
      const trimPipe = {
        body: (data: any) => data,
      };
      const catchFn = vi.fn();
      const handler = vi.fn().mockReturnValue({ chain: 'guard -> pipe -> handler' });

      const route = makeRoute({
        route: '/api/chain/guard-pipe-catch',
        fn: handler,
        functions: [
          { guard: new TestGuard() },
          { pipe: trimPipe },
          { errorHandler: catchFn },
        ],
      });
      const req = makeRequest({ path: '/api/chain/guard-pipe-catch' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).toHaveBeenCalled();
      expect(catchFn).not.toHaveBeenCalled();
      expect(res.data).toEqual({ chain: 'guard -> pipe -> handler' });
    });

    it('error in pipe prevents handler execution', async () => {
      const pipeFn = vi.fn().mockImplementation(() => { throw new Error('pipe exploded'); });
      const catchFn = vi.fn().mockImplementation((err: Error) => ({ caught: err.message }));
      const handler = vi.fn().mockReturnValue('nope');

      const route = makeRoute({
        route: '/api/chain/error-in-pipe',
        fn: handler,
        functions: [
          { pipe: { body: pipeFn } },
          { errorHandler: catchFn },
        ],
      });
      const req = makeRequest({ path: '/api/chain/error-in-pipe' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(pipeFn).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(res.data).toEqual({ caught: 'pipe exploded' });
    });

    it('error in interceptor caught by catch', async () => {
      const interceptor = vi.fn().mockImplementation(async () => { throw new Error('interceptor exploded'); });
      const catchFn = vi.fn().mockImplementation((err: Error) => ({ caught: err.message }));
      const handler = vi.fn().mockReturnValue('nope');

      const route = makeRoute({
        route: '/api/chain/error-in-intercept',
        fn: handler,
        functions: [
          { interceptor },
          { errorHandler: catchFn },
        ],
      });
      const req = makeRequest({ path: '/api/chain/error-in-intercept' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(handler).toHaveBeenCalled();
      expect(catchFn).toHaveBeenCalled();
    });
  });

  describe('Parameter decorators', () => {
    it('@Headers extracts all headers', async () => {
      const handler = vi.fn().mockImplementation((all: any, custom: string) => ({ all, custom }));
      const route = makeRoute({
        route: '/api/param/headers',
        fn: handler,
        name: 'paramHeaders',
        parameters: [
          { index: 0, type: 'headers' },
          { index: 1, type: 'headers', name: 'x-custom' },
        ],
      });
      const req = makeRequest({
        path: '/api/param/headers',
        headers: { 'x-custom': 'test-value', 'content-type': 'application/json' },
      });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({
        all: { 'x-custom': 'test-value', 'content-type': 'application/json' },
        custom: 'test-value',
      });
    });

    it('@Params extracts route params', async () => {
      const handler = vi.fn().mockImplementation((id: string, slug: string, all: any) => ({ id, slug, all }));
      const route = makeRoute({
        route: '/api/param/params/:id/:slug',
        fn: handler,
        name: 'paramParams',
        parameters: [
          { index: 0, type: 'params', name: 'id' },
          { index: 1, type: 'params', name: 'slug' },
          { index: 2, type: 'params' },
        ],
      });
      const req = makeRequest({ path: '/api/param/params/42/hello-world' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(req.params).toEqual({ id: '42', slug: 'hello-world' });
      expect(res.data).toEqual({
        id: '42',
        slug: 'hello-world',
        all: { id: '42', slug: 'hello-world' },
      });
    });

    it('@Req returns request object', async () => {
      const handler = vi.fn().mockImplementation((req: any) => ({
        method: req.method,
        path: req.path,
      }));
      const route = makeRoute({
        route: '/api/param/req',
        fn: handler,
        name: 'paramReq',
        parameters: [{ index: 0, type: 'request' }],
      });
      const req = makeRequest({ path: '/api/param/req', method: 'GET' });
      const res = makeResponse();

      await execute(route, req, res);

      expect(res.data).toEqual({ method: 'GET', path: '/api/param/req' });
    });
  });
});

// Helper: extract route metadata from decorated class
const ROUTE_META = 'controller:route';
function getRouteMeta(target: any, method: string) {
  return Reflect.getMetadata(ROUTE_META, target, method);
}
