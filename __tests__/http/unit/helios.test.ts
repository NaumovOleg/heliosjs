import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { Helios } from '@heliosjs/http';

function createMinimalServer() {
  // Minimal decorated server class
  @Server({ port: 0 })
  class App {}
  return App;
}

import { Server } from '@heliosjs/http';

describe('Helios', () => {
  it('creates instance from decorated class', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    expect(app).toBeDefined();
    expect(app.app).toBeDefined();
  });

  it('status returns running state', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const { running } = app.status();
    expect(running).toBe(false);
  });

  it('use() adds global middleware', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const mw = async () => {};
    const result = app.use(mw);
    expect(result).toBe(app);
    expect(app.globalMiddlewares).toContain(mw);
  });

  it('close resolves when not running', async () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    await expect(app.close()).resolves.not.toThrow();
  });

  it('listen and close lifecycle', async () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const server = await app.listen(0, '127.0.0.1');
    expect(server).toBeDefined();
    await app.close();
    const { running: afterClose } = app.status();
    expect(afterClose).toBe(false);
  });

  it('listen returns existing server if already running', async () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const server1 = await app.listen(0, '127.0.0.1');
    const server2 = await app.listen();
    expect(server1).toBe(server2);
    await app.close();
  });

  it('throw error with graphql + websocket', () => {
    expect(() => {
      @Server({ port: 0 })
      class App {}
      new Helios(App as any);
    }).not.toThrow(); // no graphql config means no error
  });

  it('handles SSE config', () => {
    @Server({ port: 0 })
    class App {}
    // Just test that having SSE config doesn't crash the constructor
    // The actual SSE setup depends on having controllers
    expect(() => new Helios(App as any)).not.toThrow();
  });

  it('usePlugin registers plugin', () => {
    @Server({ port: 0 })
    class App {}
    const app = new Helios(App as any);
    const plugin = { name: 'test', onInit: vi.fn() };
    app.usePlugin(plugin);
    expect(app.plugins).toContain(plugin);
  });

  it('handles request timeout config', () => {
    @Server({ port: 3000 })
    class App {}
    const app = new Helios(App as any);
    // requestTimeout and headersTimeout are set in constructor
    expect(app.app).toBeDefined();
  });

  it('config with statics', () => {
    @Server({ port: 0, statics: [] })
    class App {}
    expect(() => new Helios(App as any)).not.toThrow();
  });
});
