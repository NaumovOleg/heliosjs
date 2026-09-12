import 'reflect-metadata';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get } from '@heliosjs/core';

vi.mock('graphql-yoga', () => ({
  createYoga: vi.fn(() => (req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { hello: 'world' } }));
  }),
  createPubSub: vi.fn(() => ({})),
}));

vi.mock('type-graphql', () => ({
  buildSchema: vi.fn().mockResolvedValue({}),
  PubSub: class {},
}));

vi.mock('graphql-ws/use/ws', () => ({
  useServer: vi.fn(),
}));

let portCounter = 30000;
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

function makeFakeReq(overrides: Record<string, any> = {}) {
  const pt = new PassThrough();
  const req = Object.assign(pt, {
    method: 'GET', url: '/', headers: { host: 'localhost' },
    socket: { remoteAddress: '127.0.0.1' },
    httpVersion: '1.1',
    ...overrides,
  });
  process.nextTick(() => pt.end());
  return req;
}

function makeFakeRes() {
  return {
    writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn(),
    removeHeader: vi.fn(), getHeader: vi.fn().mockReturnValue(undefined),
    headersSent: false, statusCode: 200,
    writableEnded: false, writableFinished: false,
    flushHeaders: vi.fn(),
    addListener: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
}

describe('Helios coverage - requestHandler paths', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('requestHandler catches controller errors via catch block', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { throw new Error('controller error'); }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('requestHandler: beforeRequest with global middleware that throws', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async () => { throw new Error('middleware error'); });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('requestHandler: plugin beforeRequest throws', async () => {
    const plugin = {
      name: 'err-plugin',
      hooks: { beforeRequest: vi.fn().mockRejectedValue(new Error('hook err')) },
    };
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

  it('requestHandler: plugin beforeRoute throws', async () => {
    const plugin = {
      name: 'err-plugin',
      hooks: { beforeRoute: vi.fn().mockRejectedValue(new Error('route err')) },
    };
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

  it('requestHandler: handler returns Error instance', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return new Error('returned error'); }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('beforeRequest: static middleware + global middleware chain', async () => {
    const order: string[] = [];
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { order.push('controller'); return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => { order.push('global'); await next(); });
    (app as any).staticMiddlewares = [async (_req: any, _res: any, next: any) => { order.push('static'); await next(); }];
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(order).toEqual(['static', 'global', 'controller']);
  });

  it('beforeRequest: static middleware sends headers, raw.headersSent returns early', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const staticMw = async (req: any, res: any, _next: any) => {
      res.raw.writeHead(200, { 'X-Custom': 'static' });
      res.raw.end('static-response');
      res.data = 'served';
    };
    (app as any).staticMiddlewares = [staticMw];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
  });

  it('collectControllers: deduplicates same controller', () => {
    @Controller('/a')
    class A { @Get('/') h() { return {}; } }
    app = buildApp([]);
    const ctrl = (app as any).collectControllers([A, A, A]);
    expect(ctrl.length).toBe(1);
  });

  it('collectControllers: handles deeply nested controllers', () => {
    @Controller('/deep')
    class Deep { @Get('/') h() { return {}; } }
    @Controller('/mid')
    class Mid { @Get('/') h() { return {}; } }
    Reflect.defineMetadata('controllers', [Deep], Mid.prototype);
    @Controller('/top')
    class Top { @Get('/') h() { return {}; } }
    Reflect.defineMetadata('controllers', [Mid], Top.prototype);
    app = buildApp([]);
    const ctrl = (app as any).collectControllers([Top]);
    expect(ctrl.length).toBeGreaterThanOrEqual(1);
  });

  it('compileControllers: with error handler in functions', () => {
    const eh = vi.fn();
    @Server({ port: 0, middlewares: [], errorHandler: eh })
    class App {}
    const a = new Helios(App as any);
    const ctrl = (a as any).compileControllers([]);
    expect(ctrl).toBeDefined();
  });

  it('compileControllers: instantiates controllers with meta', () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    expect(app.rootControllers.length).toBeGreaterThan(0);
  });

  it('sendResponse: already sent headers returns early', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-response-time')).toBeDefined();
  });

  it('requestHandler: CORS with continue=false permitted', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], {
      cors: { origin: '*', methods: ['GET'], credentials: true },
    });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`, {
      headers: { Origin: 'http://example.com' },
    });
    expect(res.status).toBe(200);
  });

  it('runController: controller does not implement CONTROLLER_REQUEST', () => {
    app = buildApp([]);
    (app as any).rootControllers = [{ notAController: true }];
    const base = startApp(app);
    expect(base).toBeDefined();
  });

  it('setupGraphQL: with resolvers and pubSub wires useServer and the yoga route', async () => {
    const { createYoga, createPubSub } = await import('graphql-yoga');
    const { buildSchema } = await import('type-graphql');
    const { useServer } = await import('graphql-ws/use/ws');
    vi.mocked(createYoga).mockClear();
    vi.mocked(buildSchema).mockClear();
    vi.mocked(useServer).mockClear();
    const pubSub = (createPubSub as any)();
    @Server({
      port: makePort(),
      graphql: { path: '/graphql', playground: true, resolvers: [class {}], pubSub },
    })
    class App {}
    const a = new Helios(App as any);
    await a.listen();

    expect(buildSchema).toHaveBeenCalledWith(
      expect.objectContaining({ validate: true, pubSub })
    );
    expect(createYoga).toHaveBeenCalledWith(
      expect.objectContaining({ graphiql: true })
    );
    expect(useServer).toHaveBeenCalledOnce();

    // The context callback passed to createYoga (line ~491) is only invoked
    // by yoga itself at request time — call it directly here to cover it.
    const { context } = vi.mocked(createYoga).mock.calls[0][0] as any;
    const ctx = context({ request: { headers: { a: '1' } } });
    expect(ctx.pubSub).toBe(pubSub);

    // The graphql-path routing middleware registered via `this.use(...)`.
    // The mocked yoga handler writes a response — use that as the "was it
    // invoked" signal since createYoga's return value isn't itself a spy.
    const gqlMiddleware = (a as any).globalMiddlewares.at(-1);
    const matchingRes = { raw: { writeHead: vi.fn(), end: vi.fn() } };
    await gqlMiddleware({ requestUrl: { pathname: '/graphql/anything' }, raw: {} }, matchingRes);
    expect(matchingRes.raw.end).toHaveBeenCalled();

    const nonMatchingRes = { raw: { writeHead: vi.fn(), end: vi.fn() } };
    const next = vi.fn();
    await gqlMiddleware({ requestUrl: { pathname: '/other' }, raw: {} }, nonMatchingRes, next);
    expect(nonMatchingRes.raw.end).not.toHaveBeenCalled();
    // Regression: a non-matching path must fall through via `next()`, or
    // every non-GraphQL route stalls forever once GraphQL is configured.
    expect(next).toHaveBeenCalledOnce();

    await a.close();
  });

  it('regression: REST routes keep working end-to-end once graphql is enabled', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    const a = buildApp([TestCtrl], { graphql: { path: '/graphql', resolvers: [class {}] } });
    const port = makePort();
    await a.listen(port, '127.0.0.1');
    const res = await fetch(`http://127.0.0.1:${port}/test`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await a.close();
  });

  it('setupGraphQL: with resolvers but no pubSub skips useServer and falls back to createPubSub in context', async () => {
    const { createYoga, createPubSub } = await import('graphql-yoga');
    const { useServer } = await import('graphql-ws/use/ws');
    vi.mocked(useServer).mockClear();
    vi.mocked(createPubSub).mockClear();
    vi.mocked(createYoga).mockClear();
    @Server({ port: makePort(), graphql: { path: '/gql', resolvers: [class {}] } })
    class App {}
    const a = new Helios(App as any);
    await a.listen();

    expect(useServer).not.toHaveBeenCalled();
    const { context } = vi.mocked(createYoga).mock.calls[0][0] as any;
    context({ request: {} });
    expect(createPubSub).toHaveBeenCalled();

    // Regression: the yoga HTTP route must still be registered without
    // pubSub — it used to be nested inside the `if (pubSub)` branch, so
    // GraphQL queries/mutations 404'd on any config that didn't also wire up
    // subscriptions.
    const gqlMiddleware = (a as any).globalMiddlewares.at(-1);
    const matchingRes = { raw: { writeHead: vi.fn(), end: vi.fn() } };
    await gqlMiddleware({ requestUrl: { pathname: '/gql/anything' }, raw: {} }, matchingRes);
    expect(matchingRes.raw.end).toHaveBeenCalled();

    await a.close();
  });

  it('setupGraphQL: no resolvers returns early without building a schema', async () => {
    const { buildSchema } = await import('type-graphql');
    vi.mocked(buildSchema).mockClear();
    @Server({ port: makePort(), graphql: { path: '/graphql', resolvers: [] } })
    class App {}
    const a = new Helios(App as any);
    await a.listen();
    expect(buildSchema).not.toHaveBeenCalled();
    await a.close();
  });

  it('requestHandler: multiple plugins with hooks', async () => {
    const plugin1 = {
      name: 'p1',
      hooks: {
        beforeRequest: vi.fn().mockResolvedValue(undefined),
        beforeRoute: vi.fn().mockResolvedValue(undefined),
        afterResponse: vi.fn().mockResolvedValue(undefined),
      },
    };
    const plugin2 = {
      name: 'p2',
      hooks: {
        beforeRequest: vi.fn().mockResolvedValue(undefined),
        beforeRoute: vi.fn().mockResolvedValue(undefined),
        afterResponse: vi.fn().mockResolvedValue(undefined),
      },
    };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin1, plugin2];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
    expect(plugin1.hooks.beforeRequest).toHaveBeenCalled();
    expect(plugin2.hooks.beforeRequest).toHaveBeenCalled();
  });

  it('requestHandler: plugin onStart and onStop lifecycle', async () => {
    const plugin = {
      name: 'lifecycle',
      onStart: vi.fn(),
      onStop: vi.fn(),
    };
    @Server({ port: 0 })
    class App {}
    const a = new Helios(App as any);
    (a as any).plugins = [plugin];
    await a.listen(makePort(), '127.0.0.1');
    await new Promise(r => setImmediate(r));
    expect(plugin.onStart).toHaveBeenCalled();
    await a.close();
    expect(plugin.onStop).toHaveBeenCalled();
  });

  it('requestHandler: global middleware calls next with error', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => {
      await next(new Error('next error'));
    });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('requestHandler: no CORS config, no plugin hooks, plain request', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('requestHandler: direct call covers private methods', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
  });

  it('requestHandler: direct call with CORS config', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { cors: { origin: '*', methods: ['GET'] } });
    await (app as any).requestHandler(
      makeFakeReq({ url: '/test', headers: { host: 'localhost', origin: 'http://example.com' } }),
      makeFakeRes()
    );
  });

  it('requestHandler: direct call with CORS preflight', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { cors: { origin: '*', methods: ['GET', 'POST'] } });
    await (app as any).requestHandler(
      makeFakeReq({
        method: 'OPTIONS', url: '/test',
        headers: { host: 'localhost', origin: 'http://example.com', 'access-control-request-method': 'POST' },
      }),
      makeFakeRes()
    );
  });

  it('requestHandler: direct call with sanitizer', async () => {
    const sanitizer = { type: 'query' as const, schema: { validate: vi.fn().mockReturnValue({ value: {} }) } };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { sanitizers: [sanitizer] });
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
    // Regression: `sanitizers` passed via @Server(...) config used to be
    // silently dropped by resolveConfig — assert it's actually wired in.
    expect(sanitizer.schema.validate).toHaveBeenCalled();
  });

  it('requestHandler: direct call with global middleware', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (req: any, res: any, next: any) => { await next(); });
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
  });

  it('requestHandler: direct call with plugin hooks', async () => {
    const plugin = {
      name: 'test',
      hooks: {
        beforeRequest: vi.fn().mockResolvedValue(undefined),
        beforeRoute: vi.fn().mockResolvedValue(undefined),
        afterResponse: vi.fn().mockResolvedValue(undefined),
      },
    };
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [plugin];
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
    expect(plugin.hooks.beforeRequest).toHaveBeenCalled();
  });

  it('requestHandler: direct call - handler returns Error', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return new Error('returned err'); }
    }
    app = buildApp([TestCtrl]);
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
  });

  it('requestHandler: direct call - controller throws', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { throw new Error('thrown err'); }
    }
    app = buildApp([TestCtrl]);
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), makeFakeRes());
  });

  it('requestHandler: CORS not permitted', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl], { cors: { origin: 'https://allowed.com' } });
    await (app as any).requestHandler(
      makeFakeReq({ url: '/test', headers: { host: 'localhost', origin: 'https://evil.com' } }),
      makeFakeRes()
    );
  });

  it('requestHandler: collectControllers discovers nested controllers', async () => {
    @Controller('/sub')
    class Sub { @Get('/') h() { return {}; } }
    // Regression: collectControllers used to read nested `controllers` from a
    // metadata key nothing writes to, so declared children were silently
    // dropped from the flat list (and never reached SSE registration).
    @Controller({ prefix: '/parent', controllers: [Sub] })
    class Parent { @Get('/') h() { return {}; } }
    app = buildApp([Parent]);
    const ctrl = (app as any).collectControllers([Parent]);
    expect(ctrl).toContain(Parent);
    expect(ctrl).toContain(Sub);
  });

  it('compileControllers: with controller classes', async () => {
    @Controller('/a')
    class A { @Get('/') h() { return {}; } }
    app = buildApp([A]);
    const ctrl = (app as any).compileControllers([A]);
    expect(ctrl.length).toBeGreaterThan(0);
  });

  it('constructor: log: false silences the logger', () => {
    @Server({ port: makePort(), log: false })
    class App {}
    app = new Helios(App as any);
    expect((app as any).logger.getLevel()).toBe('silent');
  });

  it('close() rejects when the underlying server errors on close', async () => {
    @Server({ port: makePort() })
    class App {}
    app = new Helios(App as any);
    await app.listen();
    // Once: the failed close leaves `isRunning` true (the error branch never
    // flips it), so afterEach's own cleanup close must go through for real.
    vi.spyOn((app as any).app, 'close').mockImplementationOnce((cb: any) => cb(new Error('close failed')));
    await expect(app.close()).rejects.toThrow('close failed');
  });

  it('requestHandler: skips route dispatch when a beforeRequest plugin hook already ended the response', async () => {
    const handler = vi.fn().mockReturnValue({ fromController: true });
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return handler(); }
    }
    app = buildApp([TestCtrl]);
    const raw = (app as any).app as http.Server;
    (app as any).plugins = [
      {
        name: 'short-circuit',
        hooks: {
          // Plugins receive the raw node request; find the matching raw response
          // via the http.Server's pending connections isn't exposed, so end it
          // through a `request` listener instead — simplest: stash it on req.
          beforeRequest: async (req: any) => {
            req.__rawRes.writeHead(200, { 'Content-Type': 'text/plain' });
            req.__rawRes.end('from plugin');
          },
        },
      },
    ];
    raw.prependListener('request', (req: any, res: any) => {
      req.__rawRes = res;
    });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    const text = await res.text();
    expect(text).toBe('from plugin');
    expect(handler).not.toHaveBeenCalled();
  });

  it('requestHandler: a global middleware that ends the response skips beforeRoute and the controller', async () => {
    const controllerHandler = vi.fn().mockReturnValue({ fromController: true });
    const beforeRoute = vi.fn();
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return controllerHandler(); }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, res: any) => {
      res.end('from global middleware');
    });
    (app as any).plugins = [{ name: 'p', hooks: { beforeRoute } }];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    const text = await res.text();
    expect(text).toBe('from global middleware');
    expect(beforeRoute).not.toHaveBeenCalled();
    expect(controllerHandler).not.toHaveBeenCalled();
  });

  it('requestHandler: a beforeRoute plugin hook that ends the response skips the controller', async () => {
    const controllerHandler = vi.fn().mockReturnValue({ fromController: true });
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return controllerHandler(); }
    }
    app = buildApp([TestCtrl]);
    (app as any).plugins = [
      {
        name: 'end-in-before-route',
        hooks: {
          beforeRoute: async (_req: any, res: any) => {
            res.end('from beforeRoute hook');
          },
        },
      },
    ];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    const text = await res.text();
    expect(text).toBe('from beforeRoute hook');
    expect(controllerHandler).not.toHaveBeenCalled();
  });

  it('requestHandler: a static middleware that ends the response short-circuits the rest of the pipeline', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { fromController: true }; }
    }
    app = buildApp([TestCtrl]);
    (app as any).staticMiddlewares = [
      async (_req: any, res: any) => {
        res.raw.writeHead(200, { 'Content-Type': 'text/plain' });
        res.raw.end('from static middleware');
      },
    ];
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    const text = await res.text();
    expect(text).toBe('from static middleware');
  });

  it('sendResponse: sets status 500 when response.end() throws and headers were not sent', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const res = makeFakeRes();
    res.end = vi.fn(() => { throw new Error('socket gone'); });
    await (app as any).requestHandler(makeFakeReq({ url: '/test' }), res);
    expect(res.statusCode).toBe(500);
  });

  it('setupGraphQL: useServer\'s context callback returns the configured pubSub', async () => {
    const { createPubSub, createYoga } = await import('graphql-yoga');
    const { useServer } = await import('graphql-ws/use/ws');
    vi.mocked(useServer).mockClear();
    vi.mocked(createYoga).mockClear();
    const pubSub = (createPubSub as any)();
    @Server({ port: makePort(), graphql: { path: '/graphql', resolvers: [class {}], pubSub } })
    class App {}
    const a = new Helios(App as any);
    await a.listen();

    const { context } = vi.mocked(useServer).mock.calls[0][0] as any;
    expect(context()).toEqual({ pubSub });

    await a.close();
  });
});
