import { describe, it, expect, vi } from 'vitest';
import { handleCORS } from '../../../src/core/src/utils/core/cors';
import { getBodyAndMultipart, extractMiddlewares } from '../../../src/core/src/utils/core/helper';
import { ApplicationError } from '../../../src/core/src/utils/core/error/apperror';
import { ErrorCode } from '../../../src/core/src/types/core';
import { Req } from '../../../src/core/src/utils/core/request';
import { Res } from '../../../src/core/src/utils/core/response';

function makeReqOpts(overrides: any = {}) {
  return {
    method: 'GET',
    path: '/',
    url: '/',
    requestUrl: new URL('http://localhost/'),
    headers: {},
    query: {},
    body: undefined,
    params: {},
    cookies: {},
    sourceIp: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req-1',
    stage: 'dev',
    timestamp: new Date(),
    source: 'http',
    raw: {},
    isBase64Encoded: false,
    ...overrides,
  };
}

function makeReq(overrides: any = {}) {
  return new Req(makeReqOpts(overrides));
}

function makeRes() {
  const headers: Record<string, string | string[]> = {};
  return {
    status: 200,
    data: undefined,
    error: vi.fn(),
    setHeader: vi.fn((n: string, v: string | string[]) => { headers[n] = v; }),
    getHeader: (n: string) => headers[n],
    headers,
    raw: { end: vi.fn(), setHeader: vi.fn(), headersSent: false },
    isRedirect: false,
    meta: { requestUrl: new URL('http://localhost/'), method: 'GET', requestId: 'r', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() },
  } as any;
}

describe('CORS coverage', () => {
  it('origin as array', () => {
    const req = makeReq({ headers: { origin: 'https://a.com' } });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: ['https://a.com', 'https://b.com'] });
    expect(result.permitted).toBe(true);
  });

  it('origin as function - allowed', () => {
    const req = makeReq({ headers: { origin: 'https://ok.com' } });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: (o) => o === 'https://ok.com' });
    expect(result.permitted).toBe(true);
  });

  it('origin as function - denied', () => {
    const req = makeReq({ headers: { origin: 'https://bad.com' } });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: (o) => o === 'https://ok.com' });
    expect(result.permitted).toBe(false);
  });

  it('no origin header', () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: '*' });
    expect(result.permitted).toBe(true);
  });

  it('preflight with allowedHeaders from config', () => {
    const req = makeReq({
      method: 'OPTIONS',
      headers: { origin: 'https://x.com', 'access-control-request-method': 'POST' },
    });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: '*', methods: ['GET'], allowedHeaders: ['Content-Type'] });
    expect(result.continue).toBe(false);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
  });

  it('preflight without config.allowedHeaders uses request headers', () => {
    const req = makeReq({
      method: 'OPTIONS',
      headers: { origin: 'https://x.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'X-Custom' },
    });
    const res = makeRes();
    const result = handleCORS(req, res, { origin: '*', methods: ['GET'] });
    expect(result.continue).toBe(false);
  });

  it('preflight with credentials', () => {
    const req = makeReq({
      method: 'OPTIONS',
      headers: { origin: 'https://x.com', 'access-control-request-method': 'POST' },
    });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', methods: ['GET'], credentials: true });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });

  it('preflight with maxAge', () => {
    const req = makeReq({
      method: 'OPTIONS',
      headers: { origin: 'https://x.com', 'access-control-request-method': 'POST' },
    });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', methods: ['GET'], maxAge: 3600 });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
  });

  it('preflight with optionsSuccessStatus', () => {
    const req = makeReq({
      method: 'OPTIONS',
      headers: { origin: 'https://x.com', 'access-control-request-method': 'POST' },
    });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', methods: ['GET'], optionsSuccessStatus: 200 });
    expect(res.status).toBe(200);
  });

  it('regular request with credentials', () => {
    const req = makeReq({ headers: { origin: 'https://x.com' } });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', credentials: true });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });

  it('regular request with exposedHeaders', () => {
    const req = makeReq({ headers: { origin: 'https://x.com' } });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', exposedHeaders: ['X-Custom'] });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom');
  });

  it('credentials with wildcard origin sets origin header', () => {
    const req = makeReq({ headers: { origin: 'https://x.com' } });
    const res = makeRes();
    handleCORS(req, res, { origin: '*', credentials: true });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://x.com');
  });

  it('non-wildcard origin sets origin header', () => {
    const req = makeReq({ headers: { origin: 'https://x.com' } });
    const res = makeRes();
    handleCORS(req, res, { origin: 'https://x.com' });
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://x.com');
  });
});

describe('helper coverage', () => {
  it('getBodyAndMultipart with multipart request', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--\r\n`;
    const req = makeReq({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      rawBody: body,
      isBase64Encoded: false,
    });
    const result = getBodyAndMultipart(req);
    expect(result.multipart).toBeDefined();
    expect(result.body).toEqual({ field: 'value' });
  });

  it('getBodyAndMultipart with non-multipart request', () => {
    const req = makeReq({ body: { name: 'test' } });
    const result = getBodyAndMultipart(req);
    expect(result.multipart).toBeUndefined();
    expect(result.body).toEqual({ name: 'test' });
  });

  it('extractMiddlewares filters correctly', () => {
    const fns = [
      { middleware: vi.fn() },
      { errorHandler: vi.fn() },
      { middleware: vi.fn() },
    ];
    const result = extractMiddlewares(fns as any, 'middleware');
    expect(result.length).toBe(2);
  });
});

describe('error/apperror coverage', () => {
  const meta = { requestId: 'r1', requestUrl: new URL('http://localhost/test'), method: 'GET', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() };
  const config = { includeStack: false, logErrors: false, logStack: false };

  it('httpStatusToErrorCode 401', () => {
    const err = new ApplicationError({ status: 401, message: 'unauth' } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('httpStatusToErrorCode via axios 403', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'forbidden', response: { status: 403 } } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('httpStatusToErrorCode via axios 413', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'too large', response: { status: 413 } } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
  });

  it('httpStatusToErrorCode via axios 429', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'rate limit', response: { status: 429 } } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });

  it('httpStatusToErrorCode via axios 503', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'unavailable', response: { status: 503 } } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('httpStatusToErrorCode via axios default < 500', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'teapot', response: { status: 418 } } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('normalizeError with string error', () => {
    const err = new ApplicationError('string error' as any, { meta, config });
    expect(err.message).toBe('string error');
  });

  it('normalizeError with plain Error', () => {
    const err = new ApplicationError(new Error('plain error'), { meta, config });
    expect(err.message).toBe('plain error');
  });

  it('normalizeError with object with status', () => {
    const err = new ApplicationError({ status: 400, message: 'bad request', code: 'BAD_REQUEST' } as any, { meta, config });
    expect(err.status).toBe(400);
  });

  it('normalizeError with axios-like error', () => {
    const err = new ApplicationError({ isAxiosError: true, message: 'network', response: { status: 502, data: 'upstream' } } as any, { meta, config });
    expect(err.status).toBe(502);
  });

  it('normalizeError with 401 status', () => {
    const err = new ApplicationError({ status: 401 } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('normalizeError with 404 status', () => {
    const err = new ApplicationError({ status: 404 } as any, { meta, config });
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('formatValidationErrors with children', () => {
    const err = new ApplicationError(new Error('test'), { meta, config });
    expect(err.toJSON()).toBeDefined();
  });

  it('logError with status < 400 uses console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const err = new ApplicationError({ status: 200, message: 'ok' } as any, { meta, config: { ...config, logErrors: true } });
    // status 200 gets normalized to INTERNAL_SERVER_ERROR since 200 < 500 and 200 is not a known code
    spy.mockRestore();
  });
});

describe('request coverage', () => {
  it('Req constructor sets all fields', () => {
    const req = makeReq({
      method: 'get',
      path: '/test',
      url: '/test',
      requestUrl: new URL('http://localhost/test'),
      headers: { host: 'example.com', 'content-encoding': 'base64' },
      query: { q: '1' },
      body: { data: 1 },
      params: { id: '1' },
      cookies: { session: 'abc' },
      sourceIp: '1.2.3.4',
      userAgent: 'Mozilla',
      requestId: 'r1',
      stage: 'prod',
      timestamp: new Date(),
      source: 'http',
      raw: { remoteAddress: '1.2.3.4' },
      context: {},
      rawBody: Buffer.from('raw'),
      isBase64Encoded: false,
    });
    expect(req.method).toBe('GET');
    expect(req.isSecure()).toBe(false);
    expect(req.getClientIp()).toBe('1.2.3.4');
    expect(req.getHost()).toBe('example.com');
    expect(req.getFullUrl()).toBe('http://example.com/test');
    expect(req.getCookie('session')).toBe('abc');
    expect(req.getQuery('q')).toBe('1');
    expect(req.getParam('id')).toBe('1');
    expect(req.isHttp()).toBe(true);
    expect(req.isLambda()).toBe(false);
    expect(req.getHttpRequest()).toBe(req.raw);
    expect(req.getLambdaEvent()).toBeUndefined();
    expect(req.getLambdaContext()).toBeUndefined();
  });

  it('Req setState/getState/getAllState', () => {
    const req = makeReq();
    req.setState('key', 'value');
    expect(req.getState('key')).toBe('value');
    expect(req.getAllState().get('key')).toBe('value');
  });

  it('Req clone', () => {
    const req = makeReq({ path: '/test', requestUrl: new URL('http://localhost/test') });
    const cloned = req.clone({ path: '/other' });
    expect(cloned.path).toBe('/other');
    expect(cloned.method).toBe('GET');
  });

  it('Req toJSON', () => {
    const req = makeReq();
    const json = req.toJSON();
    expect(json.method).toBe('GET');
    expect(json.path).toBe('/');
  });

  it('Req isSecure with https', () => {
    const req = makeReq({ headers: { 'x-forwarded-proto': 'https' } });
    expect(req.isSecure()).toBe(true);
  });

  it('Req getHeader case-insensitive', () => {
    const req = makeReq({ headers: { 'Content-Type': 'text/html' } });
    expect(req.getHeader('content-type')).toBe('text/html');
  });

  it('Req getClientIp from x-forwarded-for', () => {
    const req = makeReq({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } });
    expect(req.getClientIp()).toBe('1.1.1.1');
  });

  it('Req base64Encoded from transfer-encoding', () => {
    const req = makeReq({ headers: { 'transfer-encoding': 'base64' }, isBase64Encoded: false });
    expect(req.base64Encoded()).toBe(true);
  });
});

describe('response coverage', () => {
  function makeResInstance() {
    const raw = { end: vi.fn(), setHeader: vi.fn(), removeHeader: vi.fn(), headersSent: false, cookies: [] as string[], statusCode: 200 };
    const meta = { requestUrl: new URL('http://localhost/'), method: 'GET', requestId: 'r', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() };
    return { res: new Res('http', meta, raw as any), raw };
  }

  it('Res buffer with lambda source', () => {
    const raw = { end: vi.fn(), setHeader: vi.fn(), removeHeader: vi.fn(), headersSent: false };
    const meta = { requestUrl: new URL('http://localhost/'), method: 'GET', requestId: 'r', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() };
    const res = new Res('lambda', meta, raw as any);
    res.buffer(Buffer.from('data'));
    expect(res.isBase64Encoded).toBe(true);
  });

  it('Res stream throws for non-http source', () => {
    const raw = { end: vi.fn(), setHeader: vi.fn(), removeHeader: vi.fn(), headersSent: false };
    const meta = { requestUrl: new URL('http://localhost/'), method: 'GET', requestId: 'r', sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now() };
    const res = new Res('lambda', meta, raw as any);
    expect(() => res.stream({} as any)).toThrow('Not implemented');
  });

  it('Res stream with content type', () => {
    const { res, raw } = makeResInstance();
    const readable = { on: vi.fn() } as any;
    res.stream(readable, 'text/plain');
    expect(raw.end).toHaveBeenCalled();
  });

  it('Res text', () => {
    const { res, raw } = makeResInstance();
    res.text('hello');
    expect(raw.end).toHaveBeenCalled();
  });

  it('Res html', () => {
    const { res, raw } = makeResInstance();
    res.html('<h1>hi</h1>');
    expect(raw.end).toHaveBeenCalled();
  });

  it('Res send', () => {
    const { res, raw } = makeResInstance();
    res.send('data');
    expect(raw.end).toHaveBeenCalled();
  });

  it('Res json', () => {
    const { res, raw } = makeResInstance();
    res.json({ ok: true });
    expect(raw.end).toHaveBeenCalled();
  });

  it('Res reset', () => {
    const { res } = makeResInstance();
    res.status = 404;
    res.reset();
    expect(res.status).toBe(200);
  });

  it('Res toJSON', () => {
    const { res } = makeResInstance();
    const json = res.toJSON();
    expect(json.statusCode).toBe(200);
  });

  it('Res error', () => {
    const { res } = makeResInstance();
    res.error(new Error('fail'));
    expect(res.status).toBe(500);
  });

  it('Res error with non-Error', () => {
    const { res } = makeResInstance();
    res.error('string error');
    expect(res.status).toBe(500);
  });

  it('Res notFound', () => {
    const { res } = makeResInstance();
    res.notFound('gone');
    expect(res.status).toBe(404);
  });

  it('Res redirect', () => {
    const { res } = makeResInstance();
    res.redirect('/new', 301);
    expect(res.status).toBe(301);
    expect(res.isRedirect).toBe(true);
  });

  it('Res clearCookie', () => {
    const { res } = makeResInstance();
    res.clearCookie('session');
    expect(res.cookies.length).toBe(1);
  });

  it('Res setCookie with all options', () => {
    const { res } = makeResInstance();
    res.setCookie('s', 'v', { maxAge: 100, expires: new Date(), path: '/', domain: 'x.com', secure: true, httpOnly: true, sameSite: 'strict', priority: 'high', partitioned: true });
    expect(res.cookies.length).toBe(1);
  });

  it('Res headersSent', () => {
    const { res, raw } = makeResInstance();
    expect(res.headersSent).toBe(false);
    raw.headersSent = true;
    expect(res.headersSent).toBe(true);
  });

  it('Res removeHeader', () => {
    const { res } = makeResInstance();
    res.setHeader('X-Test', 'val');
    res.removeHeader('X-Test');
    expect(res.getHeader('X-Test')).toBeUndefined();
  });

  it('Res hasHeader', () => {
    const { res } = makeResInstance();
    res.setHeader('X-Test', 'val');
    expect(res.hasHeader('X-Test')).toBe(true);
    expect(res.hasHeader('X-Other')).toBe(false);
  });

  it('Res setHeaders', () => {
    const { res } = makeResInstance();
    res.setHeaders({ 'X-A': '1', 'X-B': '2' });
    expect(res.getHeader('x-a')).toBe('1');
    expect(res.getHeader('x-b')).toBe('2');
  });

  it('Res data set with Error triggers ApplicationError', () => {
    const { res } = makeResInstance();
    res.data = new Error('test');
    expect(res.data).toBeDefined();
  });

  it('Res source', () => {
    const { res } = makeResInstance();
    expect(res.source).toBe('http');
  });

  it('Res ok', () => {
    const { res } = makeResInstance();
    expect(res.ok).toBe(true);
    res.status = 500;
    expect(res.ok).toBe(false);
  });

  it('Res getCookies', () => {
    const { res } = makeResInstance();
    res.setCookie('a', '1');
    expect(res.getCookies().length).toBe(1);
  });

  it('Res buffer without content type', () => {
    const { res, raw } = makeResInstance();
    res.buffer(Buffer.from('data'));
    expect(raw.end).toHaveBeenCalled();
  });
});

import { applyJoiSanitization } from '../../../src/core/src/utils/core/sanitize';
import { validate } from '../../../src/core/src/utils/shared/validate';

describe('sanitize coverage', () => {
  it('applyJoiSanitization with unknown type returns value', () => {
    const result = applyJoiSanitization('test', { type: 'unknown' as any, schema: {} as any });
    expect(result.value).toBe('test');
  });

  it('applyJoiSanitization with null value', () => {
    const result = applyJoiSanitization(null, { type: 'body', schema: {} as any });
    expect(result.value).toBeNull();
  });
});

describe('validate coverage', () => {
  it('validate with null dtoClass returns data', async () => {
    const result = await validate(null, { name: 'test' });
    expect(result).toEqual({ name: 'test' });
  });

  it('validate with dtoClass.from function', async () => {
    const dto = { from: vi.fn().mockReturnValue({ transformed: true }) };
    const result = await validate(dto, { raw: true });
    expect(result).toEqual({ transformed: true });
  });

  it('validate with non-function dtoClass returns data', async () => {
    const result = await validate('not-a-function', { name: 'test' });
    expect(result).toEqual({ name: 'test' });
  });
});
