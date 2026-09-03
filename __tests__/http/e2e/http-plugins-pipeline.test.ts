import 'reflect-metadata';
import http from 'node:http';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get } from '@heliosjs/core';

let portCounter = 24000;
function makePort() { return portCounter++; }

function buildApp(controllers: any[], serverConfig: Record<string, any> = {}): Helios {
  @Server({ port: makePort(), ...serverConfig })
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
  await new Promise<void>((resolve) => raw.listen(port, '127.0.0.1', resolve));
  const addr = raw.address() as any;
  return `http://127.0.0.1:${addr.port}`;
}

describe('E2E: Plugin lifecycle', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('onInit fires during usePlugin', async () => {
    const onInit = vi.fn();
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.usePlugin({ name: 'init-test', onInit });
    expect(onInit).toHaveBeenCalled();
  });

  it('onStart fires after listen', async () => {
    const started = vi.fn();
    @Controller('/ping')
    class PingCtrl {
      @Get('/') ping() { return { ok: true }; }
    }
    app = buildApp([PingCtrl]);
    app.usePlugin({ name: 'lifecycle', onStart: started });
    await app.listen(makePort(), '127.0.0.1');
    await new Promise(r => setTimeout(r, 50));
    expect(started).toHaveBeenCalled();
  });

  it('onStop fires after close', async () => {
    const stopped = vi.fn();
    @Controller('/ping')
    class PingCtrl {
      @Get('/') ping() { return { ok: true }; }
    }
    app = buildApp([PingCtrl]);
    app.usePlugin({ name: 'lifecycle', onStop: stopped });
    await app.listen(makePort(), '127.0.0.1');
    await app.close();
    app = undefined as any;
    expect(stopped).toHaveBeenCalled();
  });

  it('beforeRequest hook fires on each request', async () => {
    const beforeReq = vi.fn().mockResolvedValue(undefined);
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.usePlugin({ name: 'hook', hooks: { beforeRequest: beforeReq } });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    await fetch(`${base}/test`);
    expect(beforeReq).toHaveBeenCalledTimes(2);
  });

  it('afterResponse hook fires after response', async () => {
    const afterRes = vi.fn().mockResolvedValue(undefined);
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.usePlugin({ name: 'after', hooks: { afterResponse: afterRes } });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(afterRes).toHaveBeenCalledTimes(1);
  });

  it('plugin middleware runs on every request', async () => {
    const mw = vi.fn(async (_req: any, _res: any, next: any) => { await next(); });
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.usePlugin({ name: 'mw-plugin', middleware: mw });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(mw).toHaveBeenCalledTimes(1);
  });

  it('beforeRoute hook fires', async () => {
    const beforeRoute = vi.fn().mockResolvedValue(undefined);
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.usePlugin({ name: 'route', hooks: { beforeRoute } });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(beforeRoute).toHaveBeenCalledTimes(1);
  });
});

describe('E2E: Middleware pipeline', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('middleware order: global → handler', async () => {
    const order: string[] = [];
    @Controller('/test')
    class TestCtrl {
      @Get('/')
      index() { order.push('handler'); return { order }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => { order.push('global'); await next(); });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(order).toEqual(['global', 'handler']);
  });

  it('multiple global middleware in order', async () => {
    const order: string[] = [];
    @Controller('/test')
    class TestCtrl {
      @Get('/')
      index() { order.push('handler'); return { order }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, next: any) => { order.push('first'); await next(); });
    app.use(async (_req: any, _res: any, next: any) => { order.push('second'); await next(); });
    const base = await startApp(app);
    await fetch(`${base}/test`);
    expect(order).toEqual(['first', 'second', 'handler']);
  });

  it('middleware sets response headers', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, res: any, next: any) => { res.setHeader('x-custom', 'yes'); await next(); });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.headers.get('x-custom')).toBe('yes');
  });

  it('error in middleware returns 500', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    app.use(async (_req: any, _res: any, _next: any) => { throw new Error('mw crash'); });
    const base = await startApp(app);
    const res = await fetch(`${base}/test`);
    expect(res.status).toBe(500);
  });

  it('app.use is chainable', async () => {
    @Controller('/test')
    class TestCtrl {
      @Get('/') index() { return { ok: true }; }
    }
    app = buildApp([TestCtrl]);
    const ret = app.use(async (_req: any, _res: any, next: any) => { await next(); });
    expect(ret).toBe(app);
  });
});

describe('E2E: Response content types', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('returns object as application/json', async () => {
    @Controller('/json')
    class JsonCtrl {
      @Get('/') index() { return { key: 'value' }; }
    }
    app = buildApp([JsonCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/json`);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data).toEqual({ key: 'value' });
  });

  it('returns array as JSON', async () => {
    @Controller('/arr')
    class ArrCtrl {
      @Get('/') index() { return [1, 2, 3]; }
    }
    app = buildApp([ArrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/arr`);
    const data = await res.json();
    expect(data).toEqual([1, 2, 3]);
  });

  it('returns null as JSON', async () => {
    @Controller('/nil')
    class NilCtrl {
      @Get('/') index() { return null; }
    }
    app = buildApp([NilCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/nil`);
    expect(res.status).toBe(200);
  });

  it('returns string as plain text', async () => {
    @Controller('/txt')
    class TxtCtrl {
      @Get('/') index() { return 'hello'; }
    }
    app = buildApp([TxtCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/txt`);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });
});
