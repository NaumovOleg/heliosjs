import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WebSocketServer } from '../../../../src/core/src/utils/socket/server';
import { EventEmitter } from 'node:events';

function createMockServer(): any {
  const server = new EventEmitter();
  (server as any).on = server.on.bind(server);
  (server as any).emit = server.emit.bind(server);
  return server;
}

function createMockWsSocket(): any {
  const socket = new EventEmitter();
  (socket as any).send = vi.fn();
  (socket as any).close = vi.fn();
  return socket;
}

describe('WebSocketServer', () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = createMockServer();
  });

  it('creates instance with options', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    expect(wss.wss).toBeDefined();
  });

  it('getStats returns empty state initially', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const stats = wss.getStats();
    expect(stats.clients).toBe(0);
    expect(stats.topics).toEqual([]);
  });

  it('sendToClient returns false for unknown client', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    expect(wss.sendToClient('nonexistent', { msg: 'hi' })).toBe(false);
  });

  it('broadcast sends to all connected clients', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    wss.broadcast({ event: 'test' });
    // No clients, so no error
  });

  it('broadcast with excludeClientId skips that client but reaches others', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const excluded = createMockWsSocket();
    const other = createMockWsSocket();
    (wss as any).clients.set('excluded-id', { id: 'excluded-id', socket: excluded, topics: new Set(), data: {}, connectedAt: new Date() });
    (wss as any).clients.set('other-id', { id: 'other-id', socket: other, topics: new Set(), data: {}, connectedAt: new Date() });

    wss.broadcast({ event: 'test' }, 'excluded-id');
    expect(excluded.send).not.toHaveBeenCalled();
    expect(other.send).toHaveBeenCalledWith(JSON.stringify({ event: 'test' }));
  });

  it('publishToTopic does nothing when topic has no subscribers', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    wss.publishToTopic('nonexistent-topic', { data: 1 });
  });

  it('registerControllers filters controllers without websocket', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const ctrlWithoutWs = { name: 'no-ws' } as any;
    const ctrlWithWs = { name: 'with-ws', websocket: {} } as any;
    wss.registerControllers([ctrlWithoutWs, ctrlWithWs]);
    // No error thrown
  });

  it('shouldHandleWebSocket matches path prefix', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    // Access private method via any
    expect((wss as any).shouldHandleWebSocket('/ws')).toBe(true);
    expect((wss as any).shouldHandleWebSocket('/other')).toBe(false);
    expect((wss as any).shouldHandleWebSocket()).toBe(false);
  });

  it('handles upgrade event for matching path', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    // The real handshake (reading headers, writing the 101 response) is `ws`'s own
    // job and out of scope here; this test only covers WebSocketServer's routing.
    const handleUpgrade = vi.spyOn(wss.wss, 'handleUpgrade').mockImplementation(() => {});
    const fakeSocket = { __wsHandled: false, destroy: vi.fn() };
    const fakeReq = { url: '/ws' };
    mockServer.emit('upgrade', fakeReq, fakeSocket, Buffer.alloc(0));
    expect(fakeSocket.__wsHandled).toBe(true);
    expect(handleUpgrade).toHaveBeenCalledWith(fakeReq, fakeSocket, expect.any(Buffer), expect.any(Function));
  });

  it('wires a real ws "connection" event through to handleConnection', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    wss.wss.emit('connection', socket);
    expect(wss.getStats().clients).toBe(1);
  });

  it('handleUpgrade callback re-emits "connection" on the internal wss', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const fakeWs = createMockWsSocket();
    vi.spyOn(wss.wss, 'handleUpgrade').mockImplementation((_req: any, _socket: any, _head: any, cb: any) => {
      cb(fakeWs);
    });
    const fakeSocket = { __wsHandled: false, destroy: vi.fn() };
    mockServer.emit('upgrade', { url: '/ws' }, fakeSocket, Buffer.alloc(0));
    expect(wss.getStats().clients).toBe(1);
  });

  it('destroys socket for non-matching path', () => {
    const _wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const fakeSocket = { __wsHandled: false, destroy: vi.fn() };
    mockServer.emit('upgrade', { url: '/other' }, fakeSocket, Buffer.alloc(0));
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });

  it('skips already-handled upgrade', () => {
    const _wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const fakeSocket = { __wsHandled: true, destroy: vi.fn() };
    mockServer.emit('upgrade', { url: '/ws' }, fakeSocket, Buffer.alloc(0));
    expect(fakeSocket.destroy).not.toHaveBeenCalled();
  });

  it('subscribeToTopic adds client to topic', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);

    wss.subscribeToTopic(client, 'chat');
    expect(client.topics.has('chat')).toBe(true);
    expect(wss.getStats().topics.length).toBe(1);
    expect(wss.getStats().topics[0].subscribers).toBe(1);
    expect(socket.send).toHaveBeenCalled();
  });

  it('unsubscribeFromTopic removes client from topic', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c2', socket, topics: new Set(['chat']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c2', client);
    (wss as any).topics.set('chat', new Set(['c2']));

    wss.unsubscribeFromTopic(client, 'chat');
    expect(client.topics.has('chat')).toBe(false);
    expect(wss.getStats().topics.length).toBe(0);
    expect(socket.send).toHaveBeenCalled();
  });

  it('unsubscribeFromTopic cleans up empty topic set', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c3', socket, topics: new Set(['only-topic']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c3', client);
    (wss as any).topics.set('only-topic', new Set(['c3']));

    wss.unsubscribeFromTopic(client, 'only-topic');
    expect(wss.getStats().topics.length).toBe(0);
  });

  it('publishToTopic sends to subscribed clients', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket1 = createMockWsSocket();
    const socket2 = createMockWsSocket();
    const c1 = { id: 'c1', socket: socket1, topics: new Set(['news']), data: {}, connectedAt: new Date() };
    const c2 = { id: 'c2', socket: socket2, topics: new Set(['news']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', c1);
    (wss as any).clients.set('c2', c2);
    (wss as any).topics.set('news', new Set(['c1', 'c2']));

    wss.publishToTopic('news', { headline: 'test' });
    expect(socket1.send).toHaveBeenCalled();
    expect(socket2.send).toHaveBeenCalled();
  });

  it('publishToTopic with exclude skips excluded client', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket1 = createMockWsSocket();
    const c1 = { id: 'c1', socket: socket1, topics: new Set(['news']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', c1);
    (wss as any).topics.set('news', new Set(['c1']));

    wss.publishToTopic('news', { headline: 'test' }, ['c1']);
    expect(socket1.send).not.toHaveBeenCalled();
  });

  it('sendToClient sends message and returns true', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);

    const result = wss.sendToClient('c1', { msg: 'hello' });
    expect(result).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ msg: 'hello' }));
  });

  it('handleClose removes client and cleans up topics', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(['chat']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);
    (wss as any).topics.set('chat', new Set(['c1']));

    await (wss as any).handleClose(client);
    expect(wss.getStats().clients).toBe(0);
    expect(wss.getStats().topics.length).toBe(0);
  });

  it('handleClose cleans up last client in topic', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(['lonely']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);
    (wss as any).topics.set('lonely', new Set(['c1']));

    await (wss as any).handleClose(client);
    expect(wss.getStats().topics.length).toBe(0);
  });

  it('handleError triggers error handlers', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };
    await (wss as any).handleError(client, new Error('test'));
    // No error thrown
  });

  it('handleMessage processes subscribe message', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);

    await (wss as any).handleMessage(client, JSON.stringify({ type: 'subscribe', topic: 'chat' }));
    expect(client.topics.has('chat')).toBe(true);
  });

  it('handleMessage processes unsubscribe message', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(['chat']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);
    (wss as any).topics.set('chat', new Set(['c1']));

    await (wss as any).handleMessage(client, JSON.stringify({ type: 'unsubscribe', topic: 'chat' }));
    expect(client.topics.has('chat')).toBe(false);
  });

  it('handleMessage processes topic_message', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(['chat']), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);
    (wss as any).topics.set('chat', new Set(['c1']));

    await (wss as any).handleMessage(client, JSON.stringify({ type: 'topic_message', topic: 'chat', data: 'hello' }));
    // No error thrown
  });

  it('handleMessage processes regular message', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };
    (wss as any).clients.set('c1', client);

    await (wss as any).handleMessage(client, JSON.stringify({ type: 'message', data: 'hello' }));
    // No error thrown
  });

  it('handleMessage sends error on invalid JSON', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();
    const client = { id: 'c1', socket, topics: new Set(), data: {}, connectedAt: new Date() };

    await (wss as any).handleMessage(client, 'invalid json');
    expect(socket.send).toHaveBeenCalled();
  });

  it('handleConnection adds client and triggers handlers', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();

    await (wss as any).handleConnection(socket);
    expect(wss.getStats().clients).toBe(1);
  });

  it('handleConnection wires the socket message/close/error events', async () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const socket = createMockWsSocket();

    await (wss as any).handleConnection(socket);
    expect(wss.getStats().clients).toBe(1);

    socket.emit('message', JSON.stringify({ type: 'message', data: 'hi' }));
    // handleMessage is async; give its promise a tick before asserting close/error.
    await Promise.resolve();

    socket.emit('close');
    expect(wss.getStats().clients).toBe(0);

    // handleError only logs — just confirm it doesn't throw.
    socket.emit('error', new Error('boom'));
  });

  describe('triggerHandlers', () => {
    function makeController(overrides: any = {}) {
      return { name: 'ctrl', websocket: { handlers: {}, topics: [], ...overrides } } as any;
    }

    it('invokes matching event handlers with no topic filter', async () => {
      const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
      const fn = vi.fn();
      wss.registerControllers([
        makeController({ handlers: { connection: [{ type: 'connection', method: 'onConn', fn }] } }),
      ]);
      const socket = createMockWsSocket();
      await (wss as any).handleConnection(socket);
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'connection' }));
    });

    it('skips handlers registered for a different topic', async () => {
      const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
      const fn = vi.fn();
      wss.registerControllers([
        makeController({ handlers: { message: [{ type: 'message', topic: 'other', method: 'onMsg', fn }] } }),
      ]);
      const client = { id: 'c1', socket: createMockWsSocket(), topics: new Set(['chat']), data: {}, connectedAt: new Date() };
      (wss as any).clients.set('c1', client);
      (wss as any).topics.set('chat', new Set(['c1']));
      await (wss as any).handleMessage(client, JSON.stringify({ type: 'topic_message', topic: 'chat', data: 'hi' }));
      expect(fn).not.toHaveBeenCalled();
    });

    it('logs and continues when a handler throws', async () => {
      const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
      const failing = vi.fn().mockRejectedValue(new Error('handler failed'));
      wss.registerControllers([
        makeController({ handlers: { connection: [{ type: 'connection', method: 'onConn', fn: failing }] } }),
      ]);
      const socket = createMockWsSocket();
      await expect((wss as any).handleConnection(socket)).resolves.toBeUndefined();
      expect(failing).toHaveBeenCalled();
    });

    it('invokes matching topic subscriptions and logs when one throws', async () => {
      const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
      const sub = vi.fn();
      const failingSub = vi.fn().mockRejectedValue(new Error('sub failed'));
      wss.registerControllers([
        makeController({
          topics: [
            { topic: 'chat', method: 'onChat', fn: sub },
            { topic: 'chat', method: 'onChatFail', fn: failingSub },
            { topic: 'other', method: 'onOther', fn: vi.fn() },
          ],
        }),
      ]);
      const client = { id: 'c1', socket: createMockWsSocket(), topics: new Set(['chat']), data: {}, connectedAt: new Date() };
      (wss as any).clients.set('c1', client);
      (wss as any).topics.set('chat', new Set(['c1']));

      await (wss as any).handleMessage(client, JSON.stringify({ type: 'topic_message', topic: 'chat', data: 'hi' }));
      expect(sub).toHaveBeenCalledOnce();
      expect(failingSub).toHaveBeenCalledOnce();
    });
  });
});
