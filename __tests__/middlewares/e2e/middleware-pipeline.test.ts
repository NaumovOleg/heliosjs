import 'reflect-metadata';
import http from 'node:http';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post, Body } from '@heliosjs/core';
import { Use, Guard, Catch, Intercept, Status, Ok201, Ok204, Pipe } from '@heliosjs/middlewares';

let portCounter = 20000;
function makePort() {
  return portCounter++;
}

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

describe('E2E: Middleware pipeline', () => {
  let app: Helios;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined as any;
    }
  });

  it('@Use method-level middleware runs before handler', async () => {
    const calls: string[] = [];

    @Controller('/mw')
    class MwCtrl {
      @Use((_req: any, _res: any, next: any) => { calls.push('mw'); next(); })
      @Get('/')
      handler() {
        calls.push('handler');
        return { ok: true };
      }
    }

    app = buildApp([MwCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/mw`);
    expect(res.status).toBe(200);
    expect(calls).toEqual(['mw', 'handler']);
  });

  it('@Use controller-level middleware runs for all routes', async () => {
    const calls: string[] = [];

    @Use((_req: any, _res: any, next: any) => { calls.push('ctrl-mw'); next(); })
    @Controller('/all')
    class AllCtrl {
      @Get('/a')
      a() { calls.push('a'); return { a: true }; }

      @Get('/b')
      b() { calls.push('b'); return { b: true }; }
    }

    app = buildApp([AllCtrl]);
    const base = await startApp(app);

    await fetch(`${base}/all/a`);
    await fetch(`${base}/all/b`);

    expect(calls).toEqual(['ctrl-mw', 'a', 'ctrl-mw', 'b']);
  });

  it('@Use multiple middlewares run in order', async () => {
    const calls: string[] = [];

    @Controller('/seq')
    class SeqCtrl {
      @Use((_req: any, _res: any, next: any) => { calls.push('first'); next(); })
      @Use((_req: any, _res: any, next: any) => { calls.push('second'); next(); })
      @Get('/')
      handler() { calls.push('handler'); return { ok: true }; }
    }

    app = buildApp([SeqCtrl]);
    const base = await startApp(app);

    await fetch(`${base}/seq`);
    expect(calls).toEqual(['first', 'second', 'handler']);
  });

  it('@Use middleware can modify response before handler', async () => {
    @Controller('/modify')
    class ModifyCtrl {
      @Use((_req: any, res: any, _next: any) => { res.setHeader('x-custom', 'yes'); })
      @Get('/')
      handler() { return { ok: true }; }
    }

    app = buildApp([ModifyCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/modify`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-custom')).toBe('yes');
  });

  it('@Guard function guard blocks unauthorized requests', async () => {
    @Controller('/guarded')
    class GuardedCtrl {
      @Guard((req: any) => !!req.headers?.authorization)
      @Get('/')
      handler() { return { secret: true }; }
    }

    app = buildApp([GuardedCtrl]);
    const base = await startApp(app);

    const without = await fetch(`${base}/guarded`);
    expect(without.status).toBe(403);

    const withAuth = await fetch(`${base}/guarded`, {
      headers: { authorization: 'Bearer token123' },
    });
    expect(withAuth.status).toBe(200);
    expect(await withAuth.json()).toEqual({ secret: true });
  });

  it('@Guard with class-based guard', async () => {
    class AdminGuard {
      canActivate(req: any) {
        return req.headers?.['x-role'] === 'admin';
      }
    }

    @Controller('/admin')
    class AdminCtrl {
      @Guard(AdminGuard)
      @Get('/')
      handler() { return { admin: true }; }
    }

    app = buildApp([AdminCtrl]);
    const base = await startApp(app);

    const without = await fetch(`${base}/admin`);
    expect(without.status).toBe(403);

    const withRole = await fetch(`${base}/admin`, {
      headers: { 'x-role': 'admin' },
    });
    expect(withRole.status).toBe(200);
    expect(await withRole.json()).toEqual({ admin: true });
  });

  it('@Catch error handler catches thrown errors', async () => {
    const caughtErrors: Error[] = [];

    @Controller('/err')
    class ErrCtrl {
      @Catch((err: Error) => { caughtErrors.push(err); return { handled: true }; })
      @Get('/fail')
      fail() { throw new Error('boom'); }
    }

    app = buildApp([ErrCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/err/fail`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: true });
    expect(caughtErrors).toHaveLength(1);
    expect(caughtErrors[0].message).toBe('boom');
  });

  it('@Intercept wraps handler result', async () => {
    @Controller('/wrap')
    class WrapCtrl {
      @Intercept((data: any) => ({ wrapped: data }))
      @Get('/')
      handler() { return { inner: 42 }; }
    }

    app = buildApp([WrapCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/wrap`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wrapped: { inner: 42 } });
  });

  it('@Status sets custom HTTP status code', async () => {
    @Controller('/status')
    class StatusCtrl {
      @Ok201()
      @Post('/create')
      create() { return { id: 1 }; }
    }

    app = buildApp([StatusCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/status/create`, { method: 'POST' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 1 });
  });

  it('@Ok204 returns 204 with no body', async () => {
    @Controller('/del')
    class DelCtrl {
      @Ok204()
      @Get('/remove')
      remove() { return null; }
    }

    app = buildApp([DelCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/del/remove`);
    expect(res.status).toBe(204);
  });

  it('@Pipe transforms request body', async () => {
    @Controller('/pipe')
    class PipeCtrl {
      @Pipe({ body: (body: any) => ({ ...body, name: body.name.trim().toUpperCase() }) })
      @Post('/create')
      create(@Body() body: any) { return { name: body.name }; }
    }

    app = buildApp([PipeCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/pipe/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  alice  ' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'ALICE' });
  });

  it('decorator stacking: @Use + @Catch catches middleware errors', async () => {
    const caughtErrors: Error[] = [];

    @Controller('/stack')
    class StackCtrl {
      @Catch((err: Error) => { caughtErrors.push(err); return { caught: true }; })
      @Use((_req: any, _res: any, _next: any) => { throw new Error('middleware boom'); })
      @Get('/use-error')
      handler() { return { ok: true }; }
    }

    app = buildApp([StackCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/stack/use-error`);
    expect(res.status).toBe(200);
    expect(caughtErrors).toHaveLength(1);
    expect(caughtErrors[0].message).toBe('middleware boom');
  });
});
