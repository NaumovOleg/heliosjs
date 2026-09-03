import { describe, expect, it, vi } from 'vitest';
import { SSEServer } from '../../../../src/core/src/utils/sse/server';

function createMockResponse() {
  const writes: any[] = [];
  return {
    writeHead: vi.fn(),
    write: vi.fn((data: any) => { writes.push(data); }),
    on: vi.fn(),
    get writes() { return writes; },
  } as any;
}

describe('SSEServer', () => {
  it('creates a connection and returns client', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = sse.createConnection(res);
    expect(client.id).toBeDefined();
    expect(client.topics.size).toBe(0);
    expect(client.connectedAt).toBeInstanceOf(Date);
  });

  it('sets default SSE headers on connection', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    sse.createConnection(res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }));
  });

  it('sets Access-Control-Allow-Origin for wildcard without config', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    sse.createConnection(res);
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('sets origin header when origin provided without config', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    sse.createConnection(res, 'http://example.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://example.com');
  });

  it('uses CORS config for origin matching', () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://allowed.com' });
    const res = createMockResponse();
    sse.createConnection(res, 'http://allowed.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://allowed.com');
  });

  it('rejects disallowed origin with CORS config', () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: 'http://allowed.com' });
    const res = createMockResponse();
    sse.createConnection(res, 'http://evil.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('supports array origin in CORS config', () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: ['http://a.com', 'http://b.com'] });
    const res = createMockResponse();
    sse.createConnection(res, 'http://a.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://a.com');
  });

  it('supports function origin in CORS config', () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: (o: string) => o === 'http://ok.com' });
    const res = createMockResponse();
    sse.createConnection(res, 'http://ok.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Origin']).toBe('http://ok.com');
  });

  it('sets credentials header when configured', () => {
    const sse = new SSEServer();
    sse.setCorsConfig({ origin: '*', credentials: true });
    const res = createMockResponse();
    sse.createConnection(res, 'http://example.com');
    const headers = res.writeHead.mock.calls[0][1];
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('returns false for non-existent client in sendToClient', () => {
    const sse = new SSEServer();
    expect(sse.sendToClient('nonexistent', { data: 'test' })).toBe(false);
  });

  it('sends message to client', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = sse.createConnection(res);
    const result = sse.sendToClient(client.id, { data: 'hello', event: 'test', id: '1', retry: 3000 });
    expect(result).toBe(true);
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: test'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('id: 1'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('retry: 3000'));
  });

  it('sends object data as JSON', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = sse.createConnection(res);
    sse.sendToClient(client.id, { data: { key: 'value' } });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: {"key":"value"}'));
  });

  it('handles multiline data', () => {
    const sse = new SSEServer();
    const res = createMockResponse();
    const client = sse.createConnection(res);
    sse.sendToClient(client.id, { data: 'line1\nline2' });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: line1'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data: line2'));
  });

  it('broadcasts to all clients', () => {
    const sse = new SSEServer();
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const c1 = sse.createConnection(res1);
    sse.createConnection(res2);
    sse.broadcast({ data: 'hi' });
    expect(res1.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
  });

  it('broadcasts excluding a client', () => {
    const sse = new SSEServer();
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const c1 = sse.createConnection(res1);
    const c2 = sse.createConnection(res2);
    sse.broadcast({ data: 'hi' }, c1.id);
    expect(res1.write).not.toHaveBeenCalledWith(expect.stringContaining('data: hi'));
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining('data: hi'));
  });

  it('getStats returns client count', () => {
    const sse = new SSEServer();
    expect(sse.getStats().clients).toBe(0);
    const res = createMockResponse();
    sse.createConnection(res);
    expect(sse.getStats().clients).toBe(1);
  });

  it('registerControllers filters controllers without sse', () => {
    const sse = new SSEServer();
    const withSse = { sse: {} } as any;
    const without = {} as any;
    sse.registerControllers([withSse, without]);
    expect(sse.controllers).toHaveLength(1);
  });
});
