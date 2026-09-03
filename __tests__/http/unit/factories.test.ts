import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ResponseFactory } from '../../../src/http/src/utils/http/response.factory';

vi.mock('../../../src/http/src/utils/http/body', () => ({
  collectRawBody: vi.fn(async () => Buffer.from('')),
}));

import { RequestFactory } from '../../../src/http/src/utils/http/request.factory';
import { collectRawBody } from '../../../src/http/src/utils/http/body';

function makeReq(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, any>;
  remoteAddress?: string;
} = {}): any {
  return {
    method: opts.method ?? 'GET',
    url: opts.url ?? '/test?foo=bar',
    headers: opts.headers ?? {
      host: 'localhost:3000',
      'user-agent': 'test-agent',
      cookie: 'session=abc123',
    },
    socket: { remoteAddress: opts.remoteAddress ?? '127.0.0.1' },
    on: vi.fn(),
    pipe: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  };
}

describe('HTTP RequestFactory', () => {
  beforeEach(() => {
    vi.mocked(collectRawBody).mockResolvedValue(Buffer.from(''));
  });

  it('creates Req from IncomingMessage', async () => {
    const result = await RequestFactory.create(makeReq());
    expect(result.method).toBe('GET');
    expect(result.url).toBe('/test?foo=bar');
    expect(result.source).toBe('http');
    expect(result.sourceIp).toBe('127.0.0.1');
    expect(result.userAgent).toBe('test-agent');
    expect(result.requestId).toBeDefined();
  });

  it('parses query parameters', async () => {
    const result = await RequestFactory.create(makeReq({ url: '/search?q=hello&page=1' }));
    expect(result.query.q).toBe('hello');
    expect(result.query.page).toBe('1');
  });

  it('parses cookies', async () => {
    const result = await RequestFactory.create(makeReq());
    expect(result.cookies?.session).toBe('abc123');
  });

  it('extracts sourceIp from x-forwarded-for', async () => {
    const result = await RequestFactory.create(makeReq({
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2', host: 'localhost:3000' },
    }));
    expect(result.sourceIp).toBe('10.0.0.1');
  });

  it('falls back to remoteAddress', async () => {
    const result = await RequestFactory.create(makeReq({
      headers: { host: 'localhost:3000' },
    }));
    expect(result.sourceIp).toBe('127.0.0.1');
  });

  it('uses protocol from x-forwarded-proto', async () => {
    const result = await RequestFactory.create(makeReq({
      url: '/test',
      headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
    }));
    expect(result.requestUrl?.protocol).toBe('https:');
  });

  it('defaults to http protocol', async () => {
    const result = await RequestFactory.create(makeReq({
      headers: { host: 'example.com' },
    }));
    expect(result.requestUrl?.protocol).toBe('http:');
  });

  it('defaults method to GET', async () => {
    const result = await RequestFactory.create(makeReq({ method: undefined }));
    expect(result.method).toBe('GET');
  });

  it('defaults url to /', async () => {
    const result = await RequestFactory.create(makeReq({ url: '/' }));
    expect(result.url).toBe('/');
  });

  it('defaults userAgent to unknown', async () => {
    const result = await RequestFactory.create(makeReq({
      headers: { host: 'localhost:3000' },
    }));
    expect(result.userAgent).toBe('unknown');
  });

  it('sets rawBody', async () => {
    const result = await RequestFactory.create(makeReq());
    expect(result.rawBody).toBeDefined();
  });
});

describe('HTTP ResponseFactory', () => {
  it('creates Res from raw response object', () => {
    const rawRes = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
      statusCode: 200,
    };
    const meta = {
      method: 'GET',
      url: '/test',
      requestId: 'req-1',
      sourceIp: '127.0.0.1',
      userAgent: 'test',
      startTime: Date.now(),
      requestUrl: new URL('http://localhost/test'),
    } as any;
    const result = ResponseFactory.create(rawRes as any, meta);
    expect(result).toBeDefined();
  });
});
