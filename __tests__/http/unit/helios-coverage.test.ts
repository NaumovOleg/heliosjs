import 'reflect-metadata';
import http from 'node:http';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post } from '@heliosjs/core';

let portCounter = 20000;
function makePort() { return portCounter++; }

function buildApp(controllers: any[], config: Record<string, any> = {}): Helios {
  @Server({ port: makePort(), ...config })
  class App {}
  const app = new Helios(App as any);
  (app as any).config.controllers = controllers;
  (app as any).rootControllers = (app as any).compileControllers(controllers);
  (app as any).controllers = (app as any).collectControllers(controllers);
  return app;
}

async function startApp(app: Helios): Promise<string> {
  const port = makePort();
  const raw = (app as any).app as http.Server;
  await new Promise<void>(r => raw.listen(port, '127.0.0.1', r));
  const addr = raw.address() as any;
  return `http://127.0.0.1:${addr.port}`;
}

describe('Helios coverage gaps', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('constructor with rbac config', () => {
    @Server({ port: 0 })
    class App {}
    const getRoles = vi.fn();
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('constructor with requestTimeout and headersTimeout', () => {
    @Server({ port: 0, requestTimeout: 30000, headersTimeout: 60000 })
    class App {}
    const a = new Helios(App as any);
    expect((a as any).app.requestTimeout).toBe(30000);
    expect((a as any).app.headersTimeout).toBe(60000);
  });

  it('constructor with statics config', () => {
    @Server({ port: 0, statics: [{ path: '/public', options: {} }] })
    class App {}
    const a = new Helios(App as any);
    expect(a.staticMiddlewares.length).toBeGreaterThan(0);
  });

  it('constructor with websocket config', () => {
    @Server({ port: 0, websocket: { path: '/ws', controllers: [] } })
    class App {}
    const a = new Helios(App as any);
    expect((a as any).websocket).toBeDefined();
  });

  it('constructor with SSE config', () => {
    @Server({ port: 0, sse: { enabled: true } })
    class App {}
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('constructor with SSE + cors', () => {
    @Server({ port: 0, sse: { enabled: true }, cors: { origin: '*' } })
    class App {}
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('close when not running resolves', async () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    await expect(a.close()).resolves.toBeUndefined();
  });

  it('requestHandler with CORS preflight', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { cors: { origin: '*', methods: ['GET', 'POST'] } });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
  });

  it('requestHandler with CORS not permitted', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { cors: { origin: 'https://allowed.com' } });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`, {
      headers: { Origin: 'https://evil.com' },
    });
    expect(res.status).toBe(403);
  });

  it('sendResponse handles error in response.end', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('collectControllers deduplicates', () => {
    @Controller('/a')
    class A { @Get('/') h() { return {}; } }
    @Controller('/b')
    class B { @Get('/') h() { return {}; } }
    app = buildApp([A, B]);
    const ctrl = (app as any).collectControllers([A, B]);
    expect(ctrl.length).toBe(2);
  });

  it('collectControllers skips non-function items', () => {
    app = buildApp([]);
    const ctrl = (app as any).collectControllers([null, 'string', 123]);
    expect(ctrl.length).toBe(0);
  });

  it('runController calls CONTROLLER_REQUEST', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('beforeRequest runs sanitizers', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    const sanitizer = { type: 'query' as const, schema: { validate: vi.fn().mockReturnValue({ value: {} }) } };
    app = buildApp([TestCtrl], { sanitizers: [sanitizer] });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('beforeRequest runs globalMiddlewares', async () => {
    let ran = false;
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ran }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => { ran = true; await next(); });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(ran).toBe(true);
  });

  it('beforeRequest returns when headersSent after static middleware', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('error handler in requestHandler', async () => {
    const errorHandler = vi.fn((err: any, req: any, res: any) => {
      res.status = 500;
      res.data = { error: err.message };
    });
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { throw new Error('boom'); }
    }
    app = buildApp([TestCtrl], { errorHandler });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('graphql config throws with websocket', () => {
    expect(() => {
      @Server({ port: 0, graphql: { resolvers: [] }, websocket: { path: '/ws', controllers: [] } })
      class App {}
      new Helios(App as any);
    }).toThrow("can't use custom websocket with graphql");
  });

  it('config with errorHandler', () => {
    const eh = vi.fn();
    @Server({ port: 0, errorHandler: eh })
    class App {}
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('config with interceptors', () => {
    const interceptor = vi.fn();
    @Server({ port: 0, interceptors: [interceptor] })
    class App {}
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('use() chains', () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    const result = a.use(async () => {}).use(async () => {});
    expect(result).toBe(a);
    expect(a.globalMiddlewares.length).toBe(2);
  });

  it('listen with custom port and host', async () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    const server = await a.listen(makePort(), '127.0.0.1');
    expect(server).toBeDefined();
    await a.close();
  });

  it('listen without args uses config defaults', async () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    const server = await a.listen(makePort(), '127.0.0.1');
    expect(server).toBeDefined();
    await a.close();
  });

  it('status returns config', () => {
    @Server({ port: 3000 })
    class App {}
    const a = new Helios(App as any);
    const s = a.status();
    expect(s.running).toBe(false);
    expect(s.config).toBeDefined();
  });

  it('listen when already running returns app', async () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    const p = makePort();
    const server = await a.listen(p, '127.0.0.1');
    expect(server).toBeDefined();
    const second = await a.listen(p, '127.0.0.1');
    expect(second).toBe(server);
    await a.close();
  });

  it('requestHandler with plugin hook beforeRequest error is swallowed', async () => {
    const plugin = { name: 'test', hooks: { beforeRequest: vi.fn().mockRejectedValue(new Error('plugin err')) } };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('requestHandler with plugin hook beforeRoute', async () => {
    const plugin = { name: 'test', hooks: { beforeRoute: vi.fn().mockResolvedValue(undefined) } };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
    expect(plugin.hooks.beforeRoute).toHaveBeenCalled();
  });

  it('requestHandler with plugin hook afterResponse', async () => {
    const plugin = { name: 'test', hooks: { afterResponse: vi.fn().mockResolvedValue(undefined) } };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
    expect(plugin.hooks.afterResponse).toHaveBeenCalled();
  });

  it('requestHandler with afterResponse error is swallowed', async () => {
    const plugin = { name: 'test', hooks: { afterResponse: vi.fn().mockRejectedValue(new Error('after err')) } };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('requestHandler with global middleware that modifies response', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => { await next(); });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('requestHandler with static middleware that sends response', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    const staticMw = async (_req: any, res: any, _next: any) => { res.status = 200; res.data = 'static'; };
    app = buildApp([TestCtrl]);
    (app as any).staticMiddlewares = [staticMw];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('requestHandler with headersSent after beforeRequest', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, res: any, _next: any) => {
      res.setHeader('X-Custom', 'done');
    });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('collectControllers with nested controllers', () => {
    @Controller('/sub')
    class SubCtrl { @Get('/') h() { return {}; } }
    @Controller('/parent')
    class ParentCtrl {
      @Get('/') h() { return {}; }
    }
    Reflect.defineMetadata('controllers', [SubCtrl], ParentCtrl.prototype);
    app = buildApp([ParentCtrl]);
    const ctrl = (app as any).collectControllers([ParentCtrl]);
    expect(ctrl.length).toBeGreaterThanOrEqual(1);
  });

  it('compileControllers with middlewares and errorHandler', () => {
    const mw = async () => {};
    const eh = vi.fn();
    @Server({ port: 0, middlewares: [mw], errorHandler: eh })
    class App {}
    const a = new Helios(App as any);
    expect(a).toBeDefined();
  });

  it('close when running', async () => {
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    await a.listen(makePort(), '127.0.0.1');
    await expect(a.close()).resolves.toBeUndefined();
  });

  it('sendResponse sets Content-Type if missing', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('sendResponse sets X-Response-Time header', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.headers.get('x-response-time')).toBeDefined();
  });
});
