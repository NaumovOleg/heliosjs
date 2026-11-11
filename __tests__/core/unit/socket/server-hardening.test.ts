import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from '../../../../src/core/src/utils/socket/server';

function createMockServer(): any {
  return new EventEmitter() as any;
}

function createMockSocket(): any {
  const socket = new EventEmitter() as any;
  socket.write = vi.fn();
  socket.destroy = vi.fn();
  return socket;
}

function createClientSocket(): any {
  const socket = new EventEmitter() as any;
  socket.readyState = 1;
  socket.bufferedAmount = 0;
  socket.send = vi.fn();
  socket.close = vi.fn();
  return socket;
}

function makeClient(id = 'c1', topics: string[] = []): any {
  return {
    id,
    socket: createClientSocket(),
    topics: new Set(topics),
    data: {},
    connectedAt: new Date(),
  };
}

function makeRequest(overrides: Record<string, any> = {}): any {
  return {
    url: '/ws',
    headers: { host: 'example.com' },
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WebSocketServer hardening', () => {
  it('normalizes a trailing slash in the configured path', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws/' });
    expect((wss as any).shouldHandleWebSocket('/ws')).toBe(true);
    expect((wss as any).shouldHandleWebSocket('/ws/')).toBe(true);
  });

  it('returns false for an unparsable request URL', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    expect((wss as any).shouldHandleWebSocket('http://[invalid')).toBe(false);
  });

  it('rejects upgrades past maxConnections', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws', maxConnections: 0 });
    const socket = createMockSocket();
    (wss as any).handleUpgrade(makeRequest(), socket, Buffer.alloc(0));
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('503'));
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('allows a same-origin browser handshake without an explicit policy', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const accept = vi.spyOn(wss as any, 'acceptUpgrade').mockImplementation(() => {});
    await (wss as any).authorizeUpgrade(
      makeRequest({ headers: { host: 'example.com', origin: 'https://example.com' } }),
      createMockSocket(),
      Buffer.alloc(0),
      'https://example.com',
    );
    expect(accept).toHaveBeenCalled();
  });

  it('rejects a cross-origin handshake without an explicit policy', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const socket = createMockSocket();
    await (wss as any).authorizeUpgrade(
      makeRequest({ headers: { host: 'example.com', origin: 'https://evil.com' } }),
      socket,
      Buffer.alloc(0),
      'https://evil.com',
    );
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('rejects a handshake when the Host header is missing', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const socket = createMockSocket();
    await (wss as any).authorizeUpgrade(
      makeRequest({ headers: { origin: 'https://example.com' } }),
      socket,
      Buffer.alloc(0),
      'https://example.com',
    );
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('rejects a malformed Origin', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const socket = createMockSocket();
    await (wss as any).authorizeUpgrade(
      makeRequest({ headers: { host: 'example.com', origin: 'not a url' } }),
      socket,
      Buffer.alloc(0),
      'not a url',
    );
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('allows an origin matched by an array policy', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      allowedOrigins: ['https://ok.example'],
    });
    const accept = vi.spyOn(wss as any, 'acceptUpgrade').mockImplementation(() => {});
    await (wss as any).authorizeUpgrade(
      makeRequest(),
      createMockSocket(),
      Buffer.alloc(0),
      'https://ok.example',
    );
    expect(accept).toHaveBeenCalled();
  });

  it('allows an origin matched by a function policy', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      allowedOrigins: (origin: string) => origin.endsWith('.example'),
    });
    const accept = vi.spyOn(wss as any, 'acceptUpgrade').mockImplementation(() => {});
    await (wss as any).authorizeUpgrade(
      makeRequest(),
      createMockSocket(),
      Buffer.alloc(0),
      'https://app.example',
    );
    expect(accept).toHaveBeenCalled();
  });

  it('runs authenticate after the origin check', async () => {
    const authenticate = vi.fn().mockResolvedValue(true);
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      allowedOrigins: ['https://ok.example'],
      authenticate,
    });
    const accept = vi.spyOn(wss as any, 'acceptUpgrade').mockImplementation(() => {});
    const request = makeRequest();
    await (wss as any).authorizeUpgrade(request, createMockSocket(), Buffer.alloc(0), 'https://ok.example');
    expect(authenticate).toHaveBeenCalledWith(request);
    expect(accept).toHaveBeenCalled();
  });

  it('rejects when authenticate returns false', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      authenticate: () => false,
    });
    const socket = createMockSocket();
    await (wss as any).authorizeUpgrade(makeRequest(), socket, Buffer.alloc(0), undefined);
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('401'));
  });

  it('rejects when authenticate throws', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      authenticate: () => {
        throw new Error('boom');
      },
    });
    const socket = createMockSocket();
    await expect(
      (wss as any).authorizeUpgrade(makeRequest(), socket, Buffer.alloc(0), undefined),
    ).rejects.toThrow('boom');
  });

  it('does not write to an already destroyed socket', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const socket = createMockSocket();
    socket.destroyed = true;
    (wss as any).rejectUpgrade(socket, 403, 'nope');
    expect(socket.write).not.toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('closes a connection accepted past maxConnections', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws', maxConnections: 0 });
    const socket = createClientSocket();
    await (wss as any).handleConnection(socket);
    expect(socket.close).toHaveBeenCalledWith(1008, 'Connection limit reached');
  });

  it('enforces the per-client message budget', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      maxMessagesPerMinute: 0,
    });
    const client = makeClient();
    await (wss as any).handleMessage(client, JSON.stringify({ type: 'message' }));
    expect(client.socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', data: { message: 'Rate limit exceeded' } }),
    );
  });

  it('resets the message budget after a minute', () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      maxMessagesPerMinute: 1,
    });
    const client = makeClient();
    (wss as any).messageWindows.set(client.id, { startedAt: Date.now() - 61_000, count: 1 });
    expect((wss as any).consumeMessageBudget(client.id)).toBe(true);
    expect((wss as any).consumeMessageBudget(client.id)).toBe(false);
  });

  it.each([
    ['null payload', 'null'],
    ['missing type', JSON.stringify({ data: 1 })],
    ['non-string type', JSON.stringify({ type: 1 })],
    ['empty topic', JSON.stringify({ type: 'subscribe', topic: '' })],
    ['topic with NUL', JSON.stringify({ type: 'subscribe', topic: 'a\u0000b' })],
    ['topic with CR', JSON.stringify({ type: 'subscribe', topic: 'a\rb' })],
    ['topic with LF', JSON.stringify({ type: 'subscribe', topic: 'a\nb' })],
    ['topic over 128 chars', JSON.stringify({ type: 'subscribe', topic: 'a'.repeat(129) })],
  ])('rejects invalid frames: %s', async (_name, payload) => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const client = makeClient();
    await (wss as any).handleMessage(client, payload);
    expect(client.socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', data: { message: 'Invalid WebSocket message' } }),
    );
  });

  it('accepts a 128-character topic', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    expect((wss as any).isValidTopic('a'.repeat(128))).toBe(true);
  });

  it('denies client subscriptions by default', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const client = makeClient();
    await (wss as any).handleMessage(
      client,
      JSON.stringify({ type: 'subscribe', topic: 'chat' }),
    );
    expect(client.socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', data: { message: 'Not authorized' } }),
    );
  });

  it('denies client publishing by default', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const client = makeClient('c1', ['chat']);
    (wss as any).clients.set('c1', client);
    (wss as any).topics.set('chat', new Set(['c1']));
    await (wss as any).handleMessage(
      client,
      JSON.stringify({ type: 'topic_message', topic: 'chat', data: 'hi' }),
    );
    expect(client.socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', data: { message: 'Not authorized' } }),
    );
  });

  it('uses authorizeTopic for subscribe and publish decisions', async () => {
    const authorizeTopic = vi.fn((_client, topic: string, action: string) => {
      return topic === 'allowed' && action === 'subscribe';
    });
    const wss = new WebSocketServer(createMockServer(), { path: '/ws', authorizeTopic });
    const client = makeClient();
    await (wss as any).handleMessage(
      client,
      JSON.stringify({ type: 'subscribe', topic: 'allowed' }),
    );
    expect(authorizeTopic).toHaveBeenCalledWith(client, 'allowed', 'subscribe');
    expect(client.topics.has('allowed')).toBe(true);

    await (wss as any).handleMessage(
      client,
      JSON.stringify({ type: 'topic_message', topic: 'allowed', data: 'hi' }),
    );
    expect(authorizeTopic).toHaveBeenCalledWith(client, 'allowed', 'publish');
  });

  it('reads the topic from data.topic when the envelope omits it', async () => {
    const wss = new WebSocketServer(createMockServer(), {
      path: '/ws',
      allowClientSubscriptions: true,
    });
    const client = makeClient();
    await (wss as any).handleMessage(
      client,
      JSON.stringify({ type: 'subscribe', data: { topic: 'nested' } }),
    );
    expect(client.topics.has('nested')).toBe(true);
  });

  it('treats subscribe/unsubscribe/topic_message without a topic as plain messages', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const handler = vi.fn();
    wss.registerControllers([
      {
        websocket: {
          handlers: { message: [{ type: 'message', method: 'onMessage', fn: handler }] },
          topics: [],
        },
      } as any,
    ]);
    const client = makeClient();
    for (const type of ['subscribe', 'unsubscribe', 'topic_message']) {
      await (wss as any).handleMessage(client, JSON.stringify({ type }));
    }
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('filters handlers registered for a different event type', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const wrongType = vi.fn();
    const withTopic = vi.fn();
    wss.registerControllers([
      {
        websocket: {
          handlers: {
            connection: [
              { type: 'message', method: 'wrong', fn: wrongType },
              { type: 'connection', topic: 'chat', method: 'topic', fn: withTopic },
            ],
          },
          topics: [],
        },
      } as any,
    ]);
    await (wss as any).handleConnection(createClientSocket());
    expect(wrongType).not.toHaveBeenCalled();
    expect(withTopic).not.toHaveBeenCalled();
  });

  it('does not throw when unsubscribing from an unknown topic', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const client = makeClient();
    expect(() => wss.unsubscribeFromTopic(client, 'missing')).not.toThrow();
  });

  it('does not throw when closing a client whose topic set is gone', async () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    const client = makeClient('c1', ['chat']);
    (wss as any).clients.set('c1', client);
    await expect((wss as any).handleClose(client)).resolves.toBeUndefined();
  });

  it('ignores publishing to an invalid topic', () => {
    const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
    expect(() => wss.publishToTopic('', { data: 1 })).not.toThrow();
  });

  describe('sendJson', () => {
    it('returns false when the socket is not open', () => {
      const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
      const socket = createClientSocket();
      socket.readyState = 3;
      expect((wss as any).sendJson(socket, { ok: true })).toBe(false);
    });

    it('closes a slow consumer', () => {
      const wss = new WebSocketServer(createMockServer(), {
        path: '/ws',
        maxBufferedAmount: 10,
      });
      const socket = createClientSocket();
      socket.bufferedAmount = 11;
      expect((wss as any).sendJson(socket, { ok: true })).toBe(false);
      expect(socket.close).toHaveBeenCalledWith(1009, 'Slow consumer');
    });

    it('returns false when send throws', () => {
      const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
      const socket = createClientSocket();
      socket.send = vi.fn(() => {
        throw new Error('send failed');
      });
      expect((wss as any).sendJson(socket, { ok: true })).toBe(false);
    });

    it('passes string payloads through untouched', () => {
      const wss = new WebSocketServer(createMockServer(), { path: '/ws' });
      const socket = createClientSocket();
      expect((wss as any).sendJson(socket, 'raw')).toBe(true);
      expect(socket.send).toHaveBeenCalledWith('raw');
    });
  });

  describe('validation', () => {
    it.each([
      [{ maxPayload: 0 }],
      [{ maxConnections: -1 }],
      [{ maxMessagesPerMinute: 1.5 }],
      [{ maxBufferedAmount: -1 }],
    ])('rejects invalid limits: %j', (options) => {
      expect(() => new WebSocketServer(createMockServer(), { path: '/ws', ...options })).toThrow(
        TypeError,
      );
    });
  });
});
