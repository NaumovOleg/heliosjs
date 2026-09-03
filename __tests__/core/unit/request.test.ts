import { describe, expect, it } from 'vitest';
import { Req } from '@heliosjs/core/utils';

function makeReq(overrides: Record<string, any> = {}) {
  const path = overrides.path ?? '/users/1';
  const host = overrides.headers?.host ?? 'localhost';
  return new Req({
    method: 'GET',
    path,
    url: path,
    requestUrl: new URL(path, `http://${host}`),
    headers: { host, 'content-type': 'application/json' },
    query: { page: '1', search: 'test' },
    body: { name: 'John' },
    params: { id: '1' },
    cookies: { session: 'abc123' },
    sourceIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-1',
    stage: 'dev',
    source: 'http',
    timestamp: new Date(),
    ...overrides,
  });
}

describe('Req constructor', () => {
  it('initializes all properties from options', () => {
    const req = makeReq();
    expect(req.method).toBe('GET');
    expect(req.path).toBe('/users/1');
    expect(req.url).toBe('/users/1');
    expect(req.body).toEqual({ name: 'John' });
    expect(req.params).toEqual({ id: '1' });
    expect(req.cookies).toEqual({ session: 'abc123' });
    expect(req.sourceIp).toBe('192.168.1.1');
    expect(req.userAgent).toBe('Mozilla/5.0');
    expect(req.requestId).toBe('req-1');
    expect(req.stage).toBe('dev');
    expect(req.source).toBe('http');
  });

  it('uppercases method', () => {
    expect(makeReq({ method: 'get' }).method).toBe('GET');
    expect(makeReq({ method: 'post' }).method).toBe('POST');
  });

  it('defaults missing options', () => {
    const req = new Req({
      method: 'GET',
      path: '/',
      url: '/',
      requestUrl: new URL('http://localhost/'),
      headers: {},
      query: {},
      params: {},
      cookies: {},
      source: 'http',
      requestId: 'r',
      timestamp: new Date(),
    });
    expect(req.sourceIp).toBe('0.0.0.0');
    expect(req.userAgent).toBe('unknown');
    expect(req.stage).toBe('dev');
  });
});

describe('Req.getHeader', () => {
  it('retrieves header case-insensitively', () => {
    const req = makeReq({ headers: { 'X-Custom': 'value' } });
    expect(req.getHeader('x-custom')).toBe('value');
    expect(req.getHeader('X-CUSTOM')).toBe('value');
  });

  it('returns undefined for missing header', () => {
    expect(makeReq().getHeader('x-missing')).toBeUndefined();
  });
});

describe('Req.getCookie', () => {
  it('returns cookie by name', () => {
    expect(makeReq().getCookie('session')).toBe('abc123');
  });

  it('returns undefined for missing cookie', () => {
    expect(makeReq().getCookie('missing')).toBeUndefined();
  });
});

describe('Req.getQuery', () => {
  it('returns query param by name', () => {
    expect(makeReq().getQuery('page')).toBe('1');
  });

  it('returns undefined for missing query', () => {
    expect(makeReq().getQuery('missing')).toBeUndefined();
  });
});

describe('Req.getParam', () => {
  it('returns route param by name', () => {
    expect(makeReq().getParam('id')).toBe('1');
  });
});

describe('Req.isHttp / isLambda', () => {
  it('isHttp returns true for http source', () => {
    expect(makeReq({ source: 'http' }).isHttp()).toBe(true);
  });

  it('isLambda returns true for lambda source', () => {
    expect(makeReq({ source: 'lambda' }).isLambda()).toBe(true);
  });

  it('isHttp returns false for lambda source', () => {
    expect(makeReq({ source: 'lambda' }).isHttp()).toBe(false);
  });
});

describe('Req.getLambdaEvent / getLambdaContext', () => {
  it('returns raw for lambda source', () => {
    const raw = { event: 'data' };
    const req = makeReq({ source: 'lambda', raw });
    expect(req.getLambdaEvent()).toBe(raw);
  });

  it('returns undefined for http source', () => {
    expect(makeReq({ source: 'http' }).getLambdaEvent()).toBeUndefined();
  });

  it('returns context for lambda source', () => {
    const ctx = { functionName: 'myFn' };
    const req = makeReq({ source: 'lambda', context: ctx });
    expect(req.getLambdaContext()).toBe(ctx);
  });
});

describe('Req.getHttpRequest', () => {
  it('returns raw for http source', () => {
    const raw = { headers: {} };
    const req = makeReq({ source: 'http', raw });
    expect(req.getHttpRequest()).toBe(raw);
  });

  it('returns undefined for lambda source', () => {
    expect(makeReq({ source: 'lambda' }).getHttpRequest()).toBeUndefined();
  });
});

describe('Req state management', () => {
  it('set and get state', () => {
    const req = makeReq();
    req.setState('user', { id: 1 });
    expect(req.getState('user')).toEqual({ id: 1 });
  });

  it('returns undefined for missing state', () => {
    expect(makeReq().getState('missing')).toBeUndefined();
  });

  it('getAllState returns a copy', () => {
    const req = makeReq();
    req.setState('a', 1);
    const all = req.getAllState();
    all.set('b', 2);
    expect(req.getState('b')).toBeUndefined();
  });
});

describe('Req.isSecure', () => {
  it('returns true for x-forwarded-proto: https', () => {
    expect(makeReq({ headers: { 'x-forwarded-proto': 'https' } }).isSecure()).toBe(true);
  });

  it('returns false for http', () => {
    expect(makeReq().isSecure()).toBe(false);
  });
});

describe('Req.getClientIp', () => {
  it('returns first IP from x-forwarded-for', () => {
    const req = makeReq({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(req.getClientIp()).toBe('1.2.3.4');
  });

  it('falls back to sourceIp', () => {
    expect(makeReq().getClientIp()).toBe('192.168.1.1');
  });
});

describe('Req.getHost', () => {
  it('returns host header', () => {
    expect(makeReq({ headers: { host: 'example.com' } }).getHost()).toBe('example.com');
  });

  it('defaults to localhost', () => {
    expect(makeReq({ headers: {} }).getHost()).toBe('localhost');
  });
});

describe('Req.getFullUrl', () => {
  it('constructs full URL', () => {
    const req = makeReq({ path: '/users', headers: { host: 'example.com' } });
    expect(req.getFullUrl()).toBe('http://example.com/users');
  });

  it('uses https when secure', () => {
    const req = makeReq({
      path: '/users',
      headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
    });
    expect(req.getFullUrl()).toBe('https://example.com/users');
  });
});

describe('Req.clone', () => {
  it('creates a copy with overrides', () => {
    const req = makeReq();
    const cloned = req.clone({ method: 'POST', path: '/posts' });
    expect(cloned.method).toBe('POST');
    expect(cloned.path).toBe('/posts');
    expect(cloned.requestId).toBe('req-1');
  });

  it('preserves original when no overrides', () => {
    const req = makeReq();
    const cloned = req.clone();
    expect(cloned.method).toBe('GET');
    expect(cloned.path).toBe('/users/1');
  });
});

describe('Req.toJSON', () => {
  it('serializes to plain object', () => {
    const req = makeReq();
    const json = req.toJSON();
    expect(json.method).toBe('GET');
    expect(json.path).toBe('/users/1');
    expect(json.source).toBe('http');
    expect(json.requestId).toBe('req-1');
    expect(typeof json.timestamp).toBe('string');
  });
});

describe('Req.base64Encoded', () => {
  it('returns true when content-encoding is base64', () => {
    const req = makeReq({ headers: { 'content-encoding': 'base64' } });
    expect(req.base64Encoded()).toBe(true);
  });

  it('returns true when transfer-encoding is base64', () => {
    const req = makeReq({ headers: { 'transfer-encoding': 'base64' } });
    expect(req.base64Encoded()).toBe(true);
  });

  it('returns true when lambda raw has isBase64Encoded', () => {
    const req = makeReq({ source: 'lambda', raw: { isBase64Encoded: true } });
    expect(req.base64Encoded()).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(makeReq().base64Encoded()).toBe(false);
  });
});
