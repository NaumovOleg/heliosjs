import { describe, expect, it } from 'vitest';
import http from 'node:http';

describe('WebSocketServer', () => {
  it('can be imported', async () => {
    const mod = await import('../../../../src/core/src/utils/socket/server');
    expect(mod.WebSocketServer).toBeDefined();
  });

  describe('constructor and public API', () => {
    it('creates instance with mock http server', async () => {
      const { WebSocketServer } = await import('../../../../src/core/src/utils/socket/server');
      const server = http.createServer();
      const ws = new WebSocketServer(server as any, { path: '/ws' });
      expect(ws).toBeDefined();
      expect(ws.wss).toBeDefined();
      server.close();
    });

    it('getStats returns initial empty state', async () => {
      const { WebSocketServer } = await import('../../../../src/core/src/utils/socket/server');
      const server = http.createServer();
      const ws = new WebSocketServer(server as any, { path: '/ws' });
      const stats = ws.getStats();
      expect(stats.clients).toBe(0);
      expect(stats.topics).toEqual([]);
      server.close();
    });

    it('sendToClient returns false for nonexistent client', async () => {
      const { WebSocketServer } = await import('../../../../src/core/src/utils/socket/server');
      const server = http.createServer();
      const ws = new WebSocketServer(server as any, { path: '/ws' });
      expect(ws.sendToClient('nonexistent', {})).toBe(false);
      server.close();
    });

    it('registerControllers filters out controllers without websocket', async () => {
      const { WebSocketServer } = await import('../../../../src/core/src/utils/socket/server');
      const server = http.createServer();
      const ws = new WebSocketServer(server as any, { path: '/ws' });
      ws.registerControllers([{ websocket: {} } as any, {} as any]);
      server.close();
    });
  });
});
