import 'reflect-metadata';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Helios, Server, InjectSSE } from '@heliosjs/http';
import type { ISSEService } from '@heliosjs/core';
import { Controller, Get, Res } from '@heliosjs/core';
import type { Response } from '@heliosjs/core';

const apps: Helios[] = [];

afterEach(async () => {
  while (apps.length) {
    const app = apps.pop()!;
    (app.app as http.Server).closeAllConnections?.();
    await app.close();
  }
});

async function start(app: Helios): Promise<string> {
  apps.push(app);
  await app.listen(0, '127.0.0.1');
  const address = app.app.address() as { port: number };
  return `http://127.0.0.1:${address.port}`;
}

async function cancel(response: globalThis.Response): Promise<void> {
  await response.body?.cancel();
}

describe('Helios security hardening', () => {
  it('applies default security headers to res.json()', async () => {
    @Controller('/json')
    class JsonController {
      @Get('/')
      index(@Res() res: Response) {
        return res.json({ ok: true });
      }
    }

    @Server({ port: 0, controllers: [JsonController] })
    class App {}

    const app = new Helios(App as any);
    const base = await start(app);
    const response = await fetch(`${base}/json`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('adds HSTS only for secure requests', async () => {
    @Controller('/secure')
    class SecureController {
      @Get('/')
      index() {
        return { ok: true };
      }
    }

    @Server({ port: 0, controllers: [SecureController], trustProxy: true })
    class App {}

    const app = new Helios(App as any);
    const base = await start(app);

    const insecure = await fetch(`${base}/secure`);
    expect(insecure.headers.get('strict-transport-security')).toBeNull();

    const secure = await fetch(`${base}/secure`, {
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(secure.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('serves static files with security headers', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'helios-static-'));
    await fs.promises.writeFile(path.join(dir, 'asset.txt'), 'hello');

    @Server({ port: 0, statics: [{ root: dir, path: '/public' }] })
    class App {}

    const app = new Helios(App as any);
    const base = await start(app);
    const response = await fetch(`${base}/public/asset.txt`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('hello');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('derives WebSocket allowed origins from global CORS', () => {
    @Server({
      port: 0,
      cors: { origin: ['https://ok.example'] },
      websocket: { path: '/ws', controllers: [] },
    })
    class App {}

    const app = new Helios(App as any);
    expect((app as any).websocket.options.allowedOrigins).toEqual(['https://ok.example']);
  });

  it('keeps explicit WebSocket allowed origins over global CORS', () => {
    @Server({
      port: 0,
      cors: { origin: ['https://cors.example'] },
      websocket: {
        path: '/ws',
        controllers: [],
        allowedOrigins: ['https://ws.example'],
      },
    })
    class App {}

    const app = new Helios(App as any);
    expect((app as any).websocket.options.allowedOrigins).toEqual(['https://ws.example']);
  });

  it('maps every CORS origin shape to a WebSocket policy', () => {
    @Server({ port: 0, cors: { origin: '*' } })
    class Wildcard {}
    const wildcard = new Helios(Wildcard as any);
    const wildcardPolicy = (wildcard as any).websocketOrigins();
    expect(wildcardPolicy('https://anything.example')).toBe(true);

    @Server({ port: 0, cors: { origin: 'https://one.example' } })
    class Single {}
    expect((new Helios(Single as any) as any).websocketOrigins()).toEqual([
      'https://one.example',
    ]);

    @Server({ port: 0, cors: { origin: ['https://a.example', 'https://b.example'] } })
    class Many {}
    expect((new Helios(Many as any) as any).websocketOrigins()).toEqual([
      'https://a.example',
      'https://b.example',
    ]);

    const matcher = (origin: string) => origin.endsWith('.example');
    @Server({ port: 0, cors: { origin: matcher } })
    class Fn {}
    expect((new Helios(Fn as any) as any).websocketOrigins()).toBe(matcher);

    @Server({ port: 0 })
    class None {}
    expect((new Helios(None as any) as any).websocketOrigins()).toBeUndefined();
  });

  it('falls back to getHeader when a response has no hasHeader', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const response = {
      setHeader: vi.fn(),
      getHeader: vi.fn(() => undefined),
    };
    const request = { isSecure: () => false };

    (app as any).applyDefaultSecurityHeaders(request, response);

    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
  });

  it('skips security headers when the response has no setHeader', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    expect(() =>
      (app as any).applyDefaultSecurityHeaders({ isSecure: () => false }, {}),
    ).not.toThrow();
  });

  it('close() works when running without a listen promise', async () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    await new Promise<void>((resolve) => app.app.listen(0, '127.0.0.1', resolve));
    (app as any).isRunning = true;

    await expect(app.close()).resolves.toBeUndefined();
  });

  describe('SSE', () => {
    it('rejects the built-in stream route when authenticate fails', async () => {
      @Server({
        port: 0,
        sse: {
          enabled: true,
          path: '/events',
          authenticate: (request) => request.getHeader('authorization') === 'Bearer ok',
        },
      })
      class App {}

      const app = new Helios(App as any);
      const base = await start(app);
      const response = await fetch(`${base}/events`);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('SSE authentication required');
    });

    it('opens the built-in stream route when authenticate succeeds', async () => {
      @Server({
        port: 0,
        sse: {
          enabled: true,
          path: '/events',
          authenticate: (request) => request.getHeader('authorization') === 'Bearer ok',
        },
      })
      class App {}

      const app = new Helios(App as any);
      const base = await start(app);
      const response = await fetch(`${base}/events`, {
        headers: { authorization: 'Bearer ok' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      await cancel(response);
    });

    it('shadows a controller route mounted at the built-in SSE path', async () => {
      @Controller('/events')
      class EventsController {
        @Get('/')
        index() {
          return { controller: true };
        }
      }

      @Server({
        port: 0,
        controllers: [EventsController],
        sse: { enabled: true, path: '/events', authenticate: () => true },
      })
      class App {}

      const app = new Helios(App as any);
      const base = await start(app);
      const response = await fetch(`${base}/events`);

      expect(response.headers.get('content-type')).toContain('text/event-stream');
      await cancel(response);
    });

    it('enforces authenticate for connections opened by a controller', async () => {
      @Controller('/stream')
      class StreamController {
        @Get('/')
        async index(@Res() res: Response, @InjectSSE() sse: ISSEService) {
          await sse.createConnection(res.raw);
        }
      }

      @Server({
        port: 0,
        controllers: [StreamController],
        sse: { enabled: true, path: '/events', authenticate: () => false },
      })
      class App {}

      const app = new Helios(App as any);
      const base = await start(app);
      const response = await fetch(`${base}/stream`);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('SSE authentication required');
    });

    it('opens controller-created connections when authenticate succeeds', async () => {
      @Controller('/stream')
      class StreamController {
        @Get('/')
        async index(@Res() res: Response, @InjectSSE() sse: ISSEService) {
          const client = await sse.createConnection(res.raw);
          if (client) {
            sse.sendToClient(client.id, { event: 'welcome', data: { id: client.id } });
          }
        }
      }

      @Server({
        port: 0,
        controllers: [StreamController],
        sse: { enabled: true, path: '/events', authenticate: () => true },
      })
      class App {}

      const app = new Helios(App as any);
      const base = await start(app);
      const response = await fetch(`${base}/stream`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      await cancel(response);
    });
  });
});
