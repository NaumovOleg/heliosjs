import 'reflect-metadata';
import http from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post } from '@heliosjs/core';

let portCounter = 19000;

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

describe('E2E: HTTP request pipeline', () => {
  let app: Helios;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined as any;
    }
  });

  it('handles GET to controller route', async () => {
    @Controller('/users')
    class UsersCtrl {
      @Get('/')
      list() {
        return { users: ['alice', 'bob'] };
      }
    }

    app = buildApp([UsersCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/users`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ users: ['alice', 'bob'] });
  });

  it('handles param routes', async () => {
    @Controller('/items')
    class ItemsCtrl {
      @Get('/:id')
      getOne() {
        return { id: '42', name: 'widget' };
      }
    }

    app = buildApp([ItemsCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/items/42`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ id: '42', name: 'widget' });
  });

  it('returns 404 for unknown routes', async () => {
    @Controller('/known')
    class KnownCtrl {
      @Get('/')
      index() {
        return { ok: true };
      }
    }

    app = buildApp([KnownCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('handles POST request', async () => {
    @Controller('/data')
    class DataCtrl {
      @Post('/')
      create() {
        return { created: true };
      }
    }

    app = buildApp([DataCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/data`, { method: 'POST' });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ created: true });
  });

  it('sets Content-Type: application/json header', async () => {
    @Controller('/health')
    class HealthCtrl {
      @Get('/')
      check() {
        return { status: 'ok' };
      }
    }

    app = buildApp([HealthCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/health`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('global middleware runs before handler', async () => {
    let ran = false;

    @Controller('/mw')
    class MwCtrl {
      @Get('/')
      handler() {
        return { ran };
      }
    }

    app = buildApp([MwCtrl]);
    app.use(async (_req: any, _res: any, next: any) => {
      ran = true;
      await next();
    });

    const base = await startApp(app);
    const res = await fetch(`${base}/mw`);
    const data = await res.json();

    expect(ran).toBe(true);
    expect(data).toEqual({ ran: true });
  });

  it('CORS preflight returns 204', async () => {
    @Controller('/cors')
    class CorsCtrl {
      @Get('/')
      index() {
        return { ok: true };
      }
    }

    app = buildApp([CorsCtrl], { cors: { origin: '*', methods: ['GET', 'POST'] } });
    const base = await startApp(app);

    const res = await fetch(`${base}/cors`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
  });

  it('handles nested prefix routes', async () => {
    @Controller('/api')
    class ApiCtrl {
      @Get('/users')
      list() {
        return { list: true };
      }
    }

    app = buildApp([ApiCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/api/users`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ list: true });
  });

  it('returns 404 for wrong HTTP method', async () => {
    @Controller('/readonly')
    class ReadOnlyCtrl {
      @Get('/')
      get() {
        return { data: 'read-only' };
      }
    }

    app = buildApp([ReadOnlyCtrl]);
    const base = await startApp(app);

    const res = await fetch(`${base}/readonly`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
