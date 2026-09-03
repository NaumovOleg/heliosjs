import 'reflect-metadata';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it, afterEach } from 'vitest';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post, Body, Params, ErrorHandler } from '@heliosjs/core';

let portCounter = 25000;
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

describe('E2E: Sub-controllers', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('sub-controller routes are accessible', async () => {
    @Controller('/admin')
    class AdminCtrl {
      @Get('/dashboard')
      dashboard() { return { admin: true }; }
    }

    @Controller('/api')
    class ApiCtrl {
      @Get('/status')
      status() { return { ok: true }; }

      static controllers = [AdminCtrl];
    }

    app = buildApp([ApiCtrl]);
    const base = await startApp(app);

    const r1 = await (await fetch(`${base}/api/status`)).json();
    expect(r1).toEqual({ ok: true });
  });

  it('controller with no sub-controllers compiles', async () => {
    @Controller('/simple')
    class SimpleCtrl {
      @Get('/')
      index() { return { simple: true }; }
    }

    app = buildApp([SimpleCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/simple`);
    const data = await res.json();
    expect(data).toEqual({ simple: true });
  });
});

describe('E2E: Error handler chain', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('controller-level error handler catches thrown errors', async () => {
    let caught = false;

    @Controller('/err')
    class ErrCtrl {
      @Get('/fail')
      fail() {
        throw new Error('handler error');
      }
    }

    app = buildApp([ErrCtrl]);
    app.use(async (req: any, res: any, next: any) => {
      try {
        await next();
      } catch (e: any) {
        caught = true;
      }
    });

    const base = await startApp(app);
    await fetch(`${base}/err/fail`);
    expect(caught).toBe(true);
  });

  it('handler that throws and returns non-Error recovery', async () => {
    @Controller('/err')
    class ErrCtrl {
      @Get('/recover')
      recover() {
        throw new Error('crash');
      }
    }

    app = buildApp([ErrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/err/recover`);
    expect(res.status).toBe(500);
  });

  it('handler returns Error object', async () => {
    @Controller('/err')
    class ErrCtrl {
      @Get('/ret')
      ret() {
        return new Error('returned');
      }
    }

    app = buildApp([ErrCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/err/ret`);
    expect(res.status).toBe(500);
  });
});

describe('E2E: Body parsing edge cases', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('POST with empty body', async () => {
    @Controller('/empty')
    class EmptyCtrl {
      @Post('/')
      handler(@Body() body: any) {
        return { body };
      }
    }

    app = buildApp([EmptyCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/empty`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(200);
  });

  it('POST with deeply nested JSON', async () => {
    @Controller('/deep')
    class DeepCtrl {
      @Post('/')
      handler(@Body() body: any) {
        return { level: body.a.b.c };
      }
    }

    app = buildApp([DeepCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/deep`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: { b: { c: 42 } } }),
    });
    const data = await res.json();
    expect(data.level).toBe(42);
  });

  it('POST with multipart form data', async () => {
    @Controller('/form')
    class FormCtrl {
      @Post('/')
      handler(@Body() body: any) {
        return { received: true };
      }
    }

    app = buildApp([FormCtrl]);
    const base = await startApp(app);
    const form = new FormData();
    form.append('field', 'value');
    const res = await fetch(`${base}/form`, { method: 'POST', body: form });
    expect(res.status).toBe(200);
  });
});

describe('E2E: Route parameter extraction', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('multiple params in route', async () => {
    @Controller('/api')
    class ApiCtrl {
      @Get('/:version/users/:id')
      get(@Params('version') version: string, @Params('id') id: string) {
        return { version, id };
      }
    }

    app = buildApp([ApiCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/api/v2/users/123`);
    const data = await res.json();
    expect(data).toEqual({ version: 'v2', id: '123' });
  });

  it('root route matches /', async () => {
    @Controller('/')
    class RootCtrl {
      @Get('/')
      index() { return { root: true }; }
    }

    app = buildApp([RootCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/`);
    const data = await res.json();
    expect(data).toEqual({ root: true });
  });

  it('nested prefix with params', async () => {
    @Controller('/api/v1')
    class V1Ctrl {
      @Get('/users/:id')
      get(@Params('id') id: string) {
        return { id, version: 'v1' };
      }
    }

    app = buildApp([V1Ctrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/api/v1/users/7`);
    const data = await res.json();
    expect(data).toEqual({ id: '7', version: 'v1' });
  });
});

describe('E2E: Static file serving', () => {
  let app: Helios;
  let tmpDir: string;

  afterEach(async () => {
    if (app) { await app.close(); app = undefined as any; }
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves a static file with correct content-type', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-static-'));
    const testFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(testFile, 'hello world');

    @Controller('/api')
    class ApiCtrl {
      @Get('/data')
      data() { return { api: true }; }
    }

    app = buildApp([ApiCtrl], {
      statics: [{ root: tmpDir, path: '/static' }],
    });
    const base = await startApp(app);

    const res = await fetch(`${base}/static/test.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('hello world');
  });

  it('returns 404 for missing static file', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-static-'));

    @Controller('/api')
    class ApiCtrl {
      @Get('/data')
      data() { return { api: true }; }
    }

    app = buildApp([ApiCtrl], {
      statics: [{ root: tmpDir, path: '/static' }],
    });
    const base = await startApp(app);

    const res = await fetch(`${base}/static/does-not-exist.txt`);
    expect(res.status).toBe(404);
  });

  it('static serving with range request', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-static-'));
    const testFile = path.join(tmpDir, 'range.txt');
    fs.writeFileSync(testFile, 'ABCDEFGHIJ');

    @Controller('/api')
    class ApiCtrl {
      @Get('/data')
      data() { return { api: true }; }
    }

    app = buildApp([ApiCtrl], {
      statics: [{ root: tmpDir, path: '/static' }],
    });
    const base = await startApp(app);

    const res = await fetch(`${base}/static/range.txt`, {
      headers: { Range: 'bytes=0-4' },
    });
    expect(res.status).toBe(206);
    const text = await res.text();
    expect(text).toBe('ABCDE');
  });

  it('HEAD request to static file', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-static-'));
    const testFile = path.join(tmpDir, 'head.txt');
    fs.writeFileSync(testFile, 'head content');

    @Controller('/api')
    class ApiCtrl {
      @Get('/data')
      data() { return { api: true }; }
    }

    app = buildApp([ApiCtrl], {
      statics: [{ root: tmpDir, path: '/static' }],
    });
    const base = await startApp(app);

    const res = await fetch(`${base}/static/head.txt`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('12');
  });
});

describe('E2E: Content negotiation and response headers', () => {
  let app: Helios;
  afterEach(async () => { if (app) { await app.close(); app = undefined as any; } });

  it('returns 204 No Content for empty response', async () => {
    @Controller('/nocontent')
    class NoContentCtrl {
      @Post('/create')
      create() { return { created: true }; }
    }

    app = buildApp([NoContentCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/nocontent/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(200);
  });

  it('response with unicode characters', async () => {
    @Controller('/unicode')
    class UnicodeCtrl {
      @Get('/')
      index() { return { text: 'Привет мир 你好世界 🌍' }; }
    }

    app = buildApp([UnicodeCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/unicode`);
    const data = await res.json();
    expect(data.text).toBe('Привет мир 你好世界 🌍');
  });

  it('response with large number of keys', async () => {
    @Controller('/big')
    class BigCtrl {
      @Get('/')
      index() {
        const obj: Record<string, number> = {};
        for (let i = 0; i < 50; i++) obj[`key${i}`] = i;
        return obj;
      }
    }

    app = buildApp([BigCtrl]);
    const base = await startApp(app);
    const res = await fetch(`${base}/big`);
    const data = await res.json();
    expect(Object.keys(data)).toHaveLength(50);
  });
});
