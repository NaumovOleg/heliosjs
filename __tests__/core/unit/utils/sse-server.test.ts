import { afterEach, describe, expect, it, vi } from 'vitest';
import { SSEServer } from '../../../../src/core/src/utils/sse/server';
import { bindRequestToResponse } from '../../../../src/core/src/utils/shared/request-context';

function createMockResponse() {
  const writes: any[] = [];
  return {
    statusCode: 200,
    writeHead: vi.fn(),
    write: vi.fn((data: any) => {
      writes.push(data);
      return true;
    }),
    end: vi.fn(),
    on: vi.fn(),
    get writes() {
      return writes;
    },
  } as any;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SSEServer', () => {
  it('creates a connection and returns client', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    expect(client?.id).toBeDefined();
    expect(client?.topics.size).toBe(0);
    expect(client?.connectedAt).toBeInstanceOf(Date);
  });

  it('sets default SSE headers on connection', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    await sse.createConnection(res);
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      }),
    );
  });

  it('does not opt into cross-origin access without CORS config', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    await sse.createConnection(res);
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('does not reflect an origin without CORS config', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    await sse.createConnection(res, 'http://example.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('allows wildcard origin only when CORS is configured', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: '*' });
    const res = createMockResponse();
    await sse.createConnection(res, 'http://example.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('uses CORS config for origin matching', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://allowed.com' });
    const res = createMockResponse();
    await sse.createConnection(res, 'http://allowed.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://allowed.com');
  });

  it('rejects disallowed origin with CORS config', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://allowed.com' });
    const res = createMockResponse();
    const client = await sse.createConnection(res, 'http://evil.com');
    expect(client).toBeUndefined();
    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('SSE origin not allowed');
  });

  it('rejects a disallowed origin without writeHead', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://allowed.com' });
    const res = createMockResponse();
    delete res.writeHead;
    const client = await sse.createConnection(res, 'http://evil.com');
    expect(client).toBeUndefined();
    expect(res.statusCode).toBe(403);
  });

  it('supports array origin in CORS config', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: ['http://a.com', 'http://b.com'] });
    const res = createMockResponse();
    await sse.createConnection(res, 'http://a.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://a.com');
  });

  it('rejects an origin missing from an array policy', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: ['http://a.com'] });
    const res = createMockResponse();
    expect(await sse.createConnection(res, 'http://b.com')).toBeUndefined();
  });

  it('supports function origin in CORS config', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: (o: string) => o === 'http://ok.com' });
    const res = createMockResponse();
    await sse.createConnection(res, 'http://ok.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://ok.com');
  });

  it('rejects when a function origin policy returns false', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: () => false });
    const res = createMockResponse();
    expect(await sse.createConnection(res, 'http://ok.com')).toBeUndefined();
  });

  it('sets credentials header when configured', async () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://example.com', credentials: true });
    const res = createMockResponse();
    await sse.createConnection(res, 'http://example.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('rejects wildcard origin with credentials', () => {
    const sse = new SSEServer();
    expect(() => sse.setCorsConfig({ origin: '*', credentials: true })).toThrow(TypeError);
  });

  it('rejects new connections once maxConnections is reached', async () => {
    const sse = new SSEServer({ maxConnections: 0 });
    const res = createMockResponse();
    expect(await sse.createConnection(res)).toBeUndefined();
    expect(res.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('SSE connection limit reached');
  });

  describe('authentication', () => {
    it('opens the stream when authenticate resolves true', async () => {
      const request = { getHeader: () => 'Bearer token' } as any;
      const authenticate = vi.fn().mockResolvedValue(true);
      const sse = new SSEServer({ authenticate });
      const res = createMockResponse();
      bindRequestToResponse(res, request);

      const client = await sse.createConnection(res);
      expect(client).toBeDefined();
      expect(authenticate).toHaveBeenCalledWith(request);
    });

    it('rejects the stream when authenticate resolves false', async () => {
      const sse = new SSEServer({ authenticate: () => false });
      const res = createMockResponse();
      bindRequestToResponse(res, { getHeader: () => undefined } as any);

      expect(await sse.createConnection(res)).toBeUndefined();
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'text/plain' });
      expect(res.end).toHaveBeenCalledWith('SSE authentication required');
    });

    it('rejects the stream when authenticate throws', async () => {
      const sse = new SSEServer({
        authenticate: () => {
          throw new Error('boom');
        },
      });
      const res = createMockResponse();
      bindRequestToResponse(res, {} as any);

      expect(await sse.createConnection(res)).toBeUndefined();
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'text/plain' });
    });

    it('fails closed when the originating request cannot be resolved', async () => {
      const sse = new SSEServer({ authenticate: () => true });
      const res = createMockResponse();
      expect(await sse.createConnection(res)).toBeUndefined();
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'text/plain' });
    });
  });

  it('writes heartbeats and stops after the stream ends', async () => {
    vi.useFakeTimers();
    const sse = new SSEServer({ heartbeatMs: 1000 });
    const res = createMockResponse();
    await sse.createConnection(res);

    vi.advanceTimersByTime(1000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');

    res.writableEnded = true;
    vi.advanceTimersByTime(1000);
    const heartbeatCalls = res.write.mock.calls.filter(([data]: [string]) => data === ': heartbeat\n\n');
    expect(heartbeatCalls).toHaveLength(1);
  });

  it('stops heartbeats when the response is destroyed', async () => {
    vi.useFakeTimers();
    const sse = new SSEServer({ heartbeatMs: 1000 });
    const res = createMockResponse();
    await sse.createConnection(res);

    res.destroyed = true;
    vi.advanceTimersByTime(1000);
    expect(res.write).not.toHaveBeenCalledWith(': heartbeat\n\n');
  });

  it('returns false for non-existent client in sendToClient', () => {
    const sse = new SSEServer();
    expect(sse.sendToClient('nonexistent', { data: 'test' })).toBe(false);
  });

  it('sends message to client', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    const result = sse.sendToClient(client!.id, {
      data: 'hello',
      event: 'test',
      id: '1',
      retry: 3000,
    });
    expect(result).toBe(true);
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: test'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('id: 1'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('retry: 3000'));
  });

  it('sends object data as JSON', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    sse.sendToClient(client!.id, { data: { key: 'value' } });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: {"key":"value"}'));
  });

  it('handles multiline data', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    sse.sendToClient(client!.id, { data: 'line1\nline2' });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: line1'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: line2'));
  });

  it('rejects messages larger than maxMessageBytes', async () => {
    const sse = new SSEServer({ maxMessageBytes: 8 });
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    expect(sse.sendToClient(client!.id, { data: 'too large' })).toBe(false);
  });

  it('returns false when the response write returns false', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    res.write = vi.fn(() => false);
    expect(sse.sendToClient(client!.id, { data: 'x' })).toBe(false);
  });

  it('broadcasts to all clients', async () => {
    const sse = new SSEServer();
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    await sse.createConnection(res1);
    await sse.createConnection(res2);
    sse.broadcast({ data: 'hi' });
    expect(res1.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
  });

  it('broadcasts excluding a client', async () => {
    const sse = new SSEServer();
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const c1 = await sse.createConnection(res1);
    await sse.createConnection(res2);
    sse.broadcast({ data: 'hi' }, c1!.id);
    expect(res1.write).not.toHaveBeenCalledWith(expect.stringContaining('data: hi'));
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
  });

  it('getStats returns client count', async () => {
    const sse = new SSEServer();
    expect(sse.getStats().clients).toBe(0);
    await sse.createConnection(createMockResponse());
    expect(sse.getStats().clients).toBe(1);
  });

  it('registerControllers filters controllers without sse', () => {
    const sse = new SSEServer();
    const withSse = { sse: {} } as any;
    const without = {} as any;
    sse.registerControllers([withSse, without]);
    expect(sse.controllers).toHaveLength(1);
  });

  it('sendToClient returns false and logs when writing throws', async () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = await sse.createConnection(res);
    res.write = vi.fn(() => {
      throw new Error('write failed');
    });
    expect(sse.sendToClient(client!.id, { data: 'x' })).toBe(false);
  });

  describe('validation', () => {
    it.each([
      [{ maxConnections: -1 }],
      [{ heartbeatMs: 0 }],
      [{ maxMessageBytes: 1.5 }],
    ])('rejects invalid limits: %j', (options) => {
      expect(() => new SSEServer(options)).toThrow(TypeError);
    });
  });

  describe('close cleanup and handler dispatch', () => {
    function fireClose(res: ReturnType<typeof createMockResponse>) {
      const handler = res.on.mock.calls.find(([event]: [string]) => event === 'close')?.[1];
      return handler?.();
    }

    it('removes the client and runs close handlers when the response closes', async () => {
      const sse = new SSEServer();
      const connFn = vi.fn();
      const closeFn = vi.fn();
      sse.registerControllers([
        { sse: { handlers: { connection: [{ fn: connFn }], close: [{ fn: closeFn }] } } } as any,
      ]);
      const res = createMockResponse();
      await sse.createConnection(res);
      expect(sse.getStats().clients).toBe(1);
      expect(connFn).toHaveBeenCalledWith(expect.objectContaining({ type: 'connection' }));

      await fireClose(res);
      expect(sse.getStats().clients).toBe(0);
      expect(closeFn).toHaveBeenCalledWith(expect.objectContaining({ type: 'close' }));
    });

    it('supports a synchronous handler (no promise returned)', async () => {
      const sse = new SSEServer();
      const syncFn = vi.fn(() => undefined);
      sse.registerControllers([{ sse: { handlers: { connection: [{ fn: syncFn }] } } } as any]);
      const res = createMockResponse();
      await sse.createConnection(res);
      await Promise.resolve();
      expect(syncFn).toHaveBeenCalledOnce();
    });

    it('logs and continues when a handler rejects', async () => {
      const sse = new SSEServer();
      const failing = vi.fn().mockRejectedValue(new Error('boom'));
      sse.registerControllers([{ sse: { handlers: { connection: [{ fn: failing }] } } } as any]);
      const res = createMockResponse();
      await expect(sse.createConnection(res)).resolves.toBeDefined();
      await Promise.resolve();
      await Promise.resolve();
      expect(failing).toHaveBeenCalledOnce();
    });
  });
});
