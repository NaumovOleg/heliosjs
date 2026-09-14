import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { Helios } from '../../../src/azure/src/functions';
import { CONTROLLER_REQUEST } from '@heliosjs/core/constants';

function createMockController() {
  class MockController {
    static _meta: any = {};
    [CONTROLLER_REQUEST]: any;
    constructor(meta: any) {
      MockController._meta = meta;
      this[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
        res.data = { message: 'ok' };
        return res;
      });
    }
  }
  return MockController;
}

function makeRequest(overrides: ConstructorParameters<typeof HttpRequest>[0] = {}): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'https://fn.azurewebsites.net/api/test',
    headers: { host: 'fn.azurewebsites.net' },
    ...overrides,
  });
}

function makeCtx(overrides: Record<string, any> = {}): InvocationContext {
  return new InvocationContext({ functionName: 'fn', invocationId: 'inv-1', ...overrides });
}

describe('Helios (Azure Functions)', () => {
  let MockCtrl: ReturnType<typeof createMockController>;

  beforeEach(() => {
    MockCtrl = createMockController();
  });

  it('creates handler with default controller', () => {
    const app = new Helios(MockCtrl as any);
    expect(app.handler).toBeTypeOf('function');
    expect(app.controller).toBeDefined();
  });

  it('compiles controller with correct meta', () => {
    new Helios(MockCtrl as any);
    expect(MockCtrl._meta.prefix).toBe('/');
    expect(MockCtrl._meta.name).toBe('root-handler');
    expect(MockCtrl._meta.routes).toEqual([]);
    expect(MockCtrl._meta.controllers).toEqual([]);
  });

  it('handler returns 200 with data', async () => {
    const app = new Helios(MockCtrl as any);
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ message: 'ok' });
    const headers = new Headers(result.headers as any);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-request-id')).toBeDefined();
  });

  it('handler returns 500 when CONTROLLER_REQUEST throws', async () => {
    const err = new Error('boom');
    const app = new Helios(MockCtrl as any);
    (app.controller as any)[CONTROLLER_REQUEST] = vi.fn(async () => {
      throw err;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(500);
    expect(result.jsonBody).toBeDefined();
  });

  it('handler returns 500 when controller missing CONTROLLER_REQUEST', async () => {
    class BrokenCtrl {
      constructor(_meta: any) {}
    }
    const app = new Helios(BrokenCtrl as any);
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(500);
  });

  it('handler returns 400 when the request body is malformed', async () => {
    const app = new Helios(MockCtrl as any);
    const req = makeRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { string: '{not json' },
    });
    const result = await app.handler(req, makeCtx());
    expect(result.status).toBe(400);
    expect((result.jsonBody as any).code).toBe('BAD_REQUEST');
  });

  it('calls beforeRequest plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { beforeRequest: hook } });
    await app.handler(makeRequest(), makeCtx());
    expect(hook).toHaveBeenCalled();
  });

  it('calls beforeRoute plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { beforeRoute: hook } });
    await app.handler(makeRequest(), makeCtx());
    expect(hook).toHaveBeenCalled();
  });

  it('calls afterResponse plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { afterResponse: hook } });
    await app.handler(makeRequest(), makeCtx());
    expect(hook).toHaveBeenCalled();
  });

  it('sets CORS config from options', () => {
    const app = new Helios(MockCtrl as any, { cors: { origin: '*', methods: ['GET'] } });
    expect(app).toBeDefined();
  });

  it('sets RBAC config from options', () => {
    const app = new Helios(MockCtrl as any, { rbac: { getRoles: vi.fn() } });
    expect(app).toBeDefined();
  });

  it('sets fingerprint config from options', () => {
    const app = new Helios(MockCtrl as any, { fingerprint: { secret: 'my-secret' } });
    expect(app).toBeDefined();
  });

  it('controller handleRequest returns response data with its own status', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.data = { status: 404, error: 'Not Found' };
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(404);
  });

  it('routes to the error handler when the handler resolves with an error-shaped payload instead of throwing', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.data = { error: new Error('resolved-not-thrown') };
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(500);
    expect(result.jsonBody).toBeDefined();
  });

  it('includes custom response headers', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.setHeader('X-Custom', 'value');
      res.data = { status: 201, id: 1 };
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    expect(result.status).toBe(201);
    const headers = new Headers(result.headers as any);
    expect(headers.get('x-custom')).toBe('value');
  });

  it('emits one Set-Cookie header per cookie set on the response', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.setCookie('a', '1');
      res.setCookie('b', '2');
      res.data = { ok: true };
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    const headers = new Headers(result.headers as any);
    expect(headers.getSetCookie()).toHaveLength(2);
  });

  it('emits one header entry per value for a multi-value response header', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.setHeader('Vary', ['Origin', 'Accept']);
      res.data = { ok: true };
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    const entries = (result.headers as [string, string][]).filter(
      ([key]) => key.toLowerCase() === 'vary'
    );
    expect(entries.map(([, value]) => value)).toEqual(['Origin', 'Accept']);
  });

  it('rejects a disallowed CORS origin with 403 and no Access-Control-Allow-Origin', async () => {
    const app = new Helios(MockCtrl as any, { cors: { origin: 'https://allowed.example' } });
    const req = makeRequest({ headers: { origin: 'https://evil.example' } });
    const result = await app.handler(req, makeCtx());
    expect(result.status).toBe(403);
    const headers = new Headers(result.headers as any);
    expect(headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not duplicate the content-type header when the handler sets one explicitly', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.text('hello');
      return res;
    });
    const result = await app.handler(makeRequest(), makeCtx());
    const entries = (result.headers as [string, string][]).filter(
      ([key]) => key.toLowerCase() === 'content-type'
    );
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toBe('text/plain');
  });
});
