import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Helios } from '../../../src/aws/src/lambda';
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

function makeEvent(overrides: Record<string, any> = {}): any {
  return {
    httpMethod: 'GET', path: '/test', resource: '/test',
    headers: { host: 'api.example.com' },
    requestContext: { apiId: 'a', httpMethod: 'GET', identity: { sourceIp: '1.2.3.4' } },
    body: null, isBase64Encoded: false,
    ...overrides,
  };
}

function makeCtx(overrides: Record<string, any> = {}): any {
  return { awsRequestId: 'req-1', functionName: 'fn', functionVersion: '1', ...overrides };
}

describe('Helios (Lambda)', () => {
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
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: 'ok' });
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['X-Request-Id']).toBeDefined();
  });

  it('handler returns 500 when CONTROLLER_REQUEST throws', async () => {
    const err = new Error('boom');
    const app = new Helios(MockCtrl as any);
    (app.controller as any)[CONTROLLER_REQUEST] = vi.fn(async () => { throw err; });
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result.statusCode).toBe(500);
    expect(result.isBase64Encoded).toBe(false);
    expect(result.body).toBeDefined();
  });

  it('handler returns 500 when controller missing CONTROLLER_REQUEST', async () => {
    class BrokenCtrl {
      constructor(_meta: any) {}
    }
    const app = new Helios(BrokenCtrl as any);
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result.statusCode).toBe(500);
  });

  it('calls beforeRequest plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { beforeRequest: hook } });
    await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(hook).toHaveBeenCalled();
  });

  it('calls beforeRoute plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { beforeRoute: hook } });
    await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(hook).toHaveBeenCalled();
  });

  it('calls afterResponse plugin hook', async () => {
    const hook = vi.fn();
    const app = new Helios(MockCtrl as any);
    app.usePlugin({ name: 'test', hooks: { afterResponse: hook } });
    await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(hook).toHaveBeenCalled();
  });

  it('returns rest format with isBase64Encoded', async () => {
    const app = new Helios(MockCtrl as any);
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result).toHaveProperty('isBase64Encoded', false);
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('headers');
    expect(result).toHaveProperty('body');
  });

  it('returns http format with cookies for v2 events', async () => {
    const event = {
      version: '2.0', rawPath: '/test',
      headers: { host: 'api.example.com' },
      requestContext: { http: { method: 'GET', sourceIp: '1.2.3.4' }, apiId: 'a', domainName: 'api.example.com' },
    } as any;
    const app = new Helios(MockCtrl as any);
    const result = await app.handler(event, makeCtx(), undefined as any);
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('headers');
  });

  it('sets CORS config from options', () => {
    const app = new Helios(MockCtrl as any, {
      cors: { origin: '*', methods: ['GET'] },
    });
    expect(app).toBeDefined();
  });

  it('sets RBAC config from options', () => {
    const app = new Helios(MockCtrl as any, {
      rbac: { getRoles: vi.fn() },
    });
    expect(app).toBeDefined();
  });

  it('sets fingerprint config from options', () => {
    const app = new Helios(MockCtrl as any, {
      fingerprint: { secret: 'my-secret' },
    });
    expect(app).toBeDefined();
  });

  it('controller handleRequest returns response data', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.data = { status: 404, error: 'Not Found' };
      return res;
    });
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result.statusCode).toBe(404);
  });

  it('toLambdaHeaders includes custom response headers', async () => {
    const app = new Helios(MockCtrl as any);
    const instance = app.controller as any;
    instance[CONTROLLER_REQUEST] = vi.fn(async (_req: any, res: any) => {
      res.setHeader('X-Custom', 'value');
      res.data = { status: 201, id: 1 };
      return res;
    });
    const result = await app.handler(makeEvent(), makeCtx(), undefined as any);
    expect(result.statusCode).toBe(201);
  });
});
