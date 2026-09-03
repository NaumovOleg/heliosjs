import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Req } from '../../../src/core/src/utils/core/request';
import { Res } from '../../../src/core/src/utils/core/response';
import { collectRawBody } from '../../../src/http/src/utils/http/body';
import http from 'node:http';
import { Readable, PassThrough } from 'node:stream';

function makeReqOpts(overrides: any = {}) {
  return {
    method: 'GET', path: '/', url: '/', requestUrl: new URL('http://localhost/'),
    headers: {}, query: {}, body: undefined, params: {}, cookies: {},
    sourceIp: '127.0.0.1', userAgent: 'test', requestId: 'req-1', stage: 'dev',
    timestamp: new Date(), source: 'http', raw: {}, isBase64Encoded: false, ...overrides,
  };
}

function makeRes() {
  const rawRes: any = {
    end: vi.fn(), setHeader: vi.fn(), removeHeader: vi.fn(),
    headersSent: false, statusCode: 200, cookies: [],
  };
  return new Res('http', {
    requestUrl: new URL('http://localhost/'), method: 'GET', requestId: 'r1',
    sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now(),
  } as any, rawRes);
}

function makeStream(body: string): http.IncomingMessage {
  const pt = new PassThrough();
  const req = Object.assign(pt, {
    method: 'GET', url: '/', headers: {}, httpVersion: '1.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
  }) as unknown as http.IncomingMessage;
  process.nextTick(() => { pt.end(body); });
  return req;
}

function makeStreamError(err: Error): http.IncomingMessage {
  const pt = new PassThrough();
  const req = Object.assign(pt, {
    method: 'GET', url: '/', headers: {}, httpVersion: '1.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
    destroy: vi.fn(),
  }) as unknown as http.IncomingMessage;
  process.nextTick(() => { pt.destroy(err); });
  return req;
}

describe('body.ts coverage', () => {
  it('collectRawBody with content-length exceeding limit', async () => {
    const pt = new PassThrough();
    const req = Object.assign(pt, {
      method: 'GET', url: '/', headers: { 'content-length': '999999' },
      socket: { remoteAddress: '127.0.0.1' } as any,
    }) as unknown as http.IncomingMessage;
    await expect(collectRawBody(req, 100)).rejects.toThrow();
  });

  it('collectRawBody with content-length within limit', async () => {
    const req = makeStream('hello');
    (req as any).headers = { 'content-length': '5' };
    const result = await collectRawBody(req, 100);
    expect(result.toString()).toBe('hello');
  });

  it('collectRawBody with no limit (Infinity)', async () => {
    const req = makeStream('hello');
    const result = await collectRawBody(req, Infinity);
    expect(result.toString()).toBe('hello');
  });

  it('collectRawBody with zero limit', async () => {
    const req = makeStream('hello');
    const result = await collectRawBody(req, 0);
    expect(result.toString()).toBe('hello');
  });

  it('collectRawBody with stream error', async () => {
    const pt = new PassThrough();
    const req = Object.assign(pt, {
      method: 'GET', url: '/', headers: {}, httpVersion: '1.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      destroy: vi.fn(),
    }) as unknown as http.IncomingMessage;
    process.nextTick(() => { pt.emit('error', new Error('read err')); });
    await expect(collectRawBody(req, 100)).rejects.toThrow('read err');
  });

  it('collectRawBody default limit', async () => {
    const req = makeStream('hello');
    const result = await collectRawBody(req);
    expect(result.toString()).toBe('hello');
  });
});

describe('apperror.ts additional coverage', () => {
  const meta = { requestId: 'r1', requestUrl: new URL('http://localhost/test'), method: 'GET', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() };
  const config = { includeStack: true, logErrors: false, logStack: false };

  it('axios error with response only (no isAxiosError flag)', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ response: { status: 502, statusText: 'Bad Gateway', data: 'upstream' } } as any, { meta, config });
    expect(err.status).toBe(502);
  });

  it('logError status < 400 uses console.info', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    new ApplicationError({ status: 200, message: 'ok' } as any, { meta, config: { ...config, logErrors: true } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logError status 400-499 uses console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    new ApplicationError({ status: 400, message: 'bad' } as any, { meta, config: { ...config, logErrors: true } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logError status >= 500 uses console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    new ApplicationError({ status: 500, message: 'server' } as any, { meta, config: { ...config, logErrors: true } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('normalizeError with statusCode (not status)', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ statusCode: 404 } as any, { meta, config });
    expect(err.status).toBe(404);
  });

  it('axios 401', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 401 } } as any, { meta, config });
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('axios 403', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 403 } } as any, { meta, config });
    expect(err.code).toBe('FORBIDDEN');
  });

  it('axios 404', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 404 } } as any, { meta, config });
    expect(err.code).toBe('NOT_FOUND');
  });

  it('axios 429', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 429 } } as any, { meta, config });
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('axios 503', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 503 } } as any, { meta, config });
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('axios 413', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 413 } } as any, { meta, config });
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('axios >= 500', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 500 } } as any, { meta, config });
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('axios < 500 default', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ isAxiosError: true, response: { status: 418 } } as any, { meta, config });
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('object with statusCode=401', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({ statusCode: 401 } as any, { meta, config });
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('formatValidationErrors via object with errors', async () => {
    const { ApplicationError } = await import('../../../src/core/src/utils/core/error/apperror');
    const err = new ApplicationError({
      message: 'val fail',
      errors: [{
        property: 'name',
        value: '',
        constraints: { required: 'required' },
        children: [{ property: 'nested', value: '', constraints: { min: 'min' } }],
      }],
    } as any, { meta, config });
    expect(err).toBeDefined();
  });
});
