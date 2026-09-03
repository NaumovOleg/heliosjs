import 'reflect-metadata';
import http from 'node:http';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post, Put, Patch, Delete, Options, Head, Body, Params, QueryParam, Req, Res, Headers, Endpoint, HTTP_METHODS } from '@heliosjs/core';

let portCounter = 23000;
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

describe('E2E: Full HTTP request pipeline', () => {
  let app: Helios;

  afterEach(async () => {
    if (app) { await app.close(); app = undefined as any; }
  });

  it('GET with @QueryParam', async () => {
    @Controller('/search')
    class SearchCtrl {
      @Get('/')
      search(@QueryParam('q') q: string, @QueryParam('page') page: string) {
        return { q, page: page ?? '1' };
      }
    }
    app = buildApp([SearchCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/search?q=helios&page=2`);
    const data = await res.json();
    expect(data).toEqual({ q: 'helios', page: '2' });
  });

  it('GET with @Params', async () => {
    @Controller('/users')
    class UsersCtrl {
      @Get('/:id')
      getOne(@Params('id') id: string) {
        return { id };
      }
    }
    app = buildApp([UsersCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/users/42`);
    const data = await res.json();
    expect(data).toEqual({ id: '42' });
  });

  it('POST with @Body', async () => {
    @Controller('/items')
    class ItemsCtrl {
      @Post('/')
      create(@Body() body: any) {
        return { received: body };
      }
    }
    app = buildApp([ItemsCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
    const data = await res.json();
    expect(data.received).toEqual({ name: 'test' });
  });

  it('PUT with @Body and @Params', async () => {
    @Controller('/items')
    class ItemsCtrl {
      @Put('/:id')
      update(@Params('id') id: string, @Body() body: any) {
        return { id, ...body };
      }
    }
    app = buildApp([ItemsCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/items/7`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    });
    const data = await res.json();
    expect(data).toEqual({ id: '7', name: 'updated' });
  });

  it('PATCH partial update', async () => {
    @Controller('/items')
    class ItemsCtrl {
      @Patch('/:id')
      patch(@Params('id') id: string, @Body() body: any) {
        return { id, patched: body };
      }
    }
    app = buildApp([ItemsCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/items/5`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'patched' }),
    });
    const data = await res.json();
    expect(data).toEqual({ id: '5', patched: { name: 'patched' } });
  });

  it('DELETE returns result', async () => {
    @Controller('/items')
    class ItemsCtrl {
      @Delete('/:id')
      remove(@Params('id') id: string) {
        return { deleted: id };
      }
    }
    app = buildApp([ItemsCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/items/3`, { method: 'DELETE' });
    const data = await res.json();
    expect(data).toEqual({ deleted: '3' });
  });

  it('OPTIONS returns 204 with CORS preflight', async () => {
    @Controller('/api')
    class ApiCtrl {
      @Get('/')
      index() { return {}; }
    }
    app = buildApp([ApiCtrl], { cors: { origin: '*', methods: ['GET', 'POST', 'OPTIONS'] } });
    const base = await startApp(app);
    const res = await fetch(`${base}/api`, {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
  });

  it('HEAD returns 200 with no body', async () => {
    @Controller('/ping')
    class PingCtrl {
      @Head('/')
      ping() { return { alive: true }; }
    }
    app = buildApp([PingCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/ping`, { method: 'HEAD' });
    expect(res.status).toBe(200);
  });

  it('@Req injects raw request', async () => {
    @Controller('/raw')
    class RawCtrl {
      @Get('/')
      handler(@Req() req: any) {
        return { method: req.method, hasUrl: !!req.url };
      }
    }
    app = buildApp([RawCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/raw`);
    const data = await res.json();
    expect(data.method).toBe('GET');
    expect(data.hasUrl).toBe(true);
  });

  it('@Headers injects all headers', async () => {
    @Controller('/hdr')
    class HdrCtrl {
      @Get('/')
      handler(@Headers() hdrs: any) {
        return { hasHost: !!hdrs.host };
      }
    }
    app = buildApp([HdrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/hdr`);
    const data = await res.json();
    expect(data.hasHost).toBe(true);
  });

  it("@Headers('name') injects specific header", async () => {
    @Controller('/hdr')
    class HdrCtrl {
      @Get('/')
      handler(@Headers('x-custom') custom: string) {
        return { custom };
      }
    }
    app = buildApp([HdrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/hdr`, { headers: { 'x-custom': 'hello' } });
    const data = await res.json();
    expect(data.custom).toBe('hello');
  });

  it('handler throws Error → 500', async () => {
    @Controller('/err')
    class ErrCtrl {
      @Get('/crash')
      crash() {
        throw new Error('Internal failure');
      }
    }
    app = buildApp([ErrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/err/crash`);
    expect(res.status).toBe(500);
  });

  it('handler returns Error object → 500', async () => {
    @Controller('/err')
    class ErrCtrl {
      @Get('/ret')
      handler() {
        return new Error('returned error');
      }
    }
    app = buildApp([ErrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/err/ret`);
    expect(res.status).toBe(500);
  });

  it('multiple controllers with different prefixes', async () => {
    @Controller('/api/users')
    class UsersCtrl {
      @Get('/')
      list() { return { users: true }; }
    }
    @Controller('/api/items')
    class ItemsCtrl {
      @Get('/')
      list() { return { items: true }; }
    }
    app = buildApp([UsersCtrl, ItemsCtrl]);
    const base = await startApp(app);

    const u = await (await fetch(`${base}/api/users`)).json();
    const i = await (await fetch(`${base}/api/items`)).json();
    expect(u).toEqual({ users: true });
    expect(i).toEqual({ items: true });
  });

  it('global middleware modifies request state', async () => {
    @Controller('/mw')
    class MwCtrl {
      @Get('/')
      handler() { return { fromMiddleware: true }; }
    }
    app = buildApp([MwCtrl]);
    app.use(async (req: any, _res: any, next: any) => {
      req.setState('called', true);
      await next();
    });
    const base = await startApp(app);
    const res = await fetch(`${base}/mw`);
    expect(res.status).toBe(200);
  });

  it('CORS: blocked origin returns 403', async () => {
    @Controller('/secure')
    class SecureCtrl {
      @Get('/')
      index() { return { ok: true }; }
    }
    app = buildApp([SecureCtrl], { cors: { origin: 'https://allowed.com' } });
    const base = await startApp(app);
    const res = await fetch(`${base}/secure`, {
      headers: { 'Origin': 'https://evil.com' },
    });
    expect(res.status).toBe(403);
  });

  it('CORS: allowed origin returns header', async () => {
    @Controller('/open')
    class OpenCtrl {
      @Get('/')
      index() { return { ok: true }; }
    }
    app = buildApp([OpenCtrl], { cors: { origin: 'https://allowed.com' } });
    const base = await startApp(app);
    const res = await fetch(`${base}/open`, {
      headers: { 'Origin': 'https://allowed.com' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://allowed.com');
  });

  it('response header set by handler', async () => {
    @Controller('/hdr-set')
    class HdrCtrl {
      @Get('/')
      handler(@Res() res: any) {
        res.setHeader('x-custom', 'yes');
        return { ok: true };
      }
    }
    app = buildApp([HdrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/hdr-set`);
    expect(res.headers.get('x-custom')).toBe('yes');
  });

  it('large JSON body', async () => {
    @Controller('/bulk')
    class BulkCtrl {
      @Post('/')
      handler(@Body() body: any) {
        return { count: body.items.length };
      }
    }
    app = buildApp([BulkCtrl]);
    const base = await startApp(app);
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const res = await fetch(`${base}/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    expect(data.count).toBe(100);
  });

  it('Endpoint decorator with ANY method', async () => {
    @Controller('/any')
    class AnyCtrl {
      @Endpoint(HTTP_METHODS.ANY, '/catchall')
      handler() { return { any: true }; }
    }
    app = buildApp([AnyCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/any/catchall`, { method: 'DELETE' });
    const data = await res.json();
    expect(data).toEqual({ any: true });
  });

  it('sequential requests', async () => {
    @Controller('/seq')
    class SeqCtrl {
      @Get('/')
      index() { return { seq: true }; }
    }
    app = buildApp([SeqCtrl]);
    const base = await startApp(app);
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${base}/seq`);
      expect(res.status).toBe(200);
    }
  });

  it('concurrent requests', async () => {
    @Controller('/conc')
    class ConcCtrl {
      @Get('/')
      async handler() {
        await new Promise(r => setTimeout(r, 10));
        return { ok: true };
      }
    }
    app = buildApp([ConcCtrl]);
    const base = await startApp(app);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${base}/conc`).then(r => r.json()))
    );
    expect(results).toEqual(Array.from({ length: 10 }, () => ({ ok: true })));
  });

  it('query params with special characters', async () => {
    @Controller('/q')
    class QCtrl {
      @Get('/')
      handler(@QueryParam('name') name: string) {
        return { name };
      }
    }
    app = buildApp([QCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/q?name=${encodeURIComponent('hello world&more')}`);
    const data = await res.json();
    expect(data.name).toBe('hello world&more');
  });
});
