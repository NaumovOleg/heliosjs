import { describe, expect, it } from 'vitest';
import { handleCORS } from '@heliosjs/core/utils';
import { makeRequest, makeResponse } from '../../helpers/http';

function reqWithOrigin(origin?: string, method = 'GET', extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (origin) headers.origin = origin;
  return makeRequest({ method, headers }) as any;
}

function res() {
  return makeResponse() as any;
}

describe('handleCORS', () => {
  it('returns permitted+continue for same-origin request', () => {
    const result = handleCORS(reqWithOrigin('http://localhost'), res(), { origin: 'http://localhost' });
    expect(result.permitted).toBe(true);
    expect(result.continue).toBe(true);
  });

  it('blocks disallowed origin', () => {
    const r = res();
    const result = handleCORS(reqWithOrigin('http://evil.com'), r, { origin: 'http://localhost' });
    expect(result.permitted).toBe(false);
    expect(result.continue).toBe(false);
    expect(r.status).toBe(403);
  });

  it('allows wildcard origin', () => {
    const result = handleCORS(reqWithOrigin('http://any.com'), res(), { origin: '*' });
    expect(result.permitted).toBe(true);
    expect(result.continue).toBe(true);
  });

  it('allows array of origins', () => {
    const result = handleCORS(reqWithOrigin('http://b.com'), res(), {
      origin: ['http://a.com', 'http://b.com'],
    });
    expect(result.permitted).toBe(true);
  });

  it('blocks origin not in array', () => {
    const r = res();
    const result = handleCORS(reqWithOrigin('http://c.com'), r, {
      origin: ['http://a.com', 'http://b.com'],
    });
    expect(result.permitted).toBe(false);
  });

  it('supports function origin', () => {
    const result = handleCORS(reqWithOrigin('http://ok.com'), res(), {
      origin: (o) => o === 'http://ok.com',
    });
    expect(result.permitted).toBe(true);
  });

  it('handles preflight OPTIONS request', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost', 'OPTIONS', {
      'access-control-request-method': 'POST',
    });
    const result = handleCORS(req, r, { origin: '*', methods: ['GET', 'POST'] });
    expect(result.permitted).toBe(true);
    expect(result.continue).toBe(false);
    expect(r.status).toBe(204);
    expect(r.headers['Access-Control-Allow-Methods']).toBe('GET, POST');
  });

  it('sets credentials header when configured', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost', 'OPTIONS', {
      'access-control-request-method': 'POST',
    });
    handleCORS(req, r, { origin: '*', credentials: true });
    expect(r.headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('sets max-age header when configured', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost', 'OPTIONS', {
      'access-control-request-method': 'POST',
    });
    handleCORS(req, r, { origin: '*', maxAge: 3600 });
    expect(r.headers['Access-Control-Max-Age']).toBe('3600');
  });

  it('sets allowed headers from config', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost', 'OPTIONS', {
      'access-control-request-method': 'POST',
    });
    handleCORS(req, r, { origin: '*', allowedHeaders: ['X-Custom', 'Authorization'] });
    expect(r.headers['Access-Control-Allow-Headers']).toBe('X-Custom, Authorization');
  });

  it('echoes request headers when no allowedHeaders configured', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost', 'OPTIONS', {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'X-Custom',
    });
    handleCORS(req, r, { origin: '*' });
    expect(r.headers['Access-Control-Allow-Headers']).toBe('X-Custom');
  });

  it('sets exposed headers on non-preflight', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost');
    handleCORS(req, r, { origin: '*', exposedHeaders: ['X-Total'] });
    expect(r.headers['Access-Control-Expose-Headers']).toBe('X-Total');
  });

  it('allows requests without origin header', () => {
    const result = handleCORS(makeRequest({ headers: {} }) as any, res(), { origin: 'http://localhost' });
    expect(result.permitted).toBe(true);
    expect(result.continue).toBe(true);
  });

  it('sets origin header with credentials uses actual origin', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost');
    handleCORS(req, r, { origin: '*', credentials: true });
    expect(r.headers['Access-Control-Allow-Origin']).toBe('http://localhost');
  });

  it('sets origin header without credentials uses *', () => {
    const r = res();
    const req = reqWithOrigin('http://localhost');
    handleCORS(req, r, { origin: '*' });
    expect(r.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
