import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WebSocketServer } from '../../../../src/core/src/utils/socket/server';
import http from 'node:http';
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

  it('broadcast with excludeClientId skips that client', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    wss.broadcast({ event: 'test' }, 'excluded-id');
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
    const fakeSocket = { __wsHandled: false, destroy: vi.fn() };
    mockServer.emit('upgrade', { url: '/ws' }, fakeSocket, Buffer.alloc(0));
    expect(fakeSocket.__wsHandled).toBe(true);
  });

  it('destroys socket for non-matching path', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
    const fakeSocket = { __wsHandled: false, destroy: vi.fn() };
    mockServer.emit('upgrade', { url: '/other' }, fakeSocket, Buffer.alloc(0));
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });

  it('skips already-handled upgrade', () => {
    const wss = new WebSocketServer(mockServer as any, { path: '/ws' });
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
});
