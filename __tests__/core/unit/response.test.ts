import { describe, expect, it, vi } from 'vitest';
import { Res } from '@heliosjs/core/utils';

function makeRes(source: 'http' | 'lambda' | 'unknown' = 'http') {
  const raw: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      raw.headers[name] = value;
    },
    removeHeader(name: string) {
      delete raw.headers[name];
    },
    end: vi.fn(),
    cookies: [] as string[],
  };
  const meta = {
    requestUrl: new URL('http://localhost/test'),
    method: 'GET',
    requestId: 'req-1',
    sourceIp: '127.0.0.1',
    userAgent: 'test',
    startTime: Date.now(),
  };
  return { res: new Res(source, meta, raw), raw, meta };
}

describe('Res constructor', () => {
  it('sets default status 200', () => {
    const { res } = makeRes();
    expect(res.status).toBe(200);
  });

  it('sets default Content-Type to application/json', () => {
    const { res } = makeRes();
    expect(res.getHeader('content-type')).toBe('application/json');
  });

  it('stores meta', () => {
    const { res } = makeRes();
    expect(res.meta.requestId).toBe('req-1');
  });
});

describe('Res status', () => {
  it('get/set status', () => {
    const { res } = makeRes();
    res.status = 201;
    expect(res.status).toBe(201);
  });

  it('getStatus() returns current status', () => {
    const { res } = makeRes();
    expect(res.getStatus()).toBe(200);
  });

  it('syncs with raw.statusCode', () => {
    const { res, raw } = makeRes();
    res.status = 404;
    expect(raw.statusCode).toBe(404);
  });

  it('ignores falsy status', () => {
    const { res } = makeRes();
    res.status = 0;
    expect(res.status).toBe(200);
  });
});

describe('Res headers', () => {
  it('setHeader / getHeader', () => {
    const { res } = makeRes();
    res.setHeader('X-Custom', 'value');
    expect(res.getHeader('x-custom')).toBe('value');
  });

  it('hasHeader', () => {
    const { res } = makeRes();
    expect(res.hasHeader('content-type')).toBe(true);
    expect(res.hasHeader('x-missing')).toBe(false);
  });

  it('removeHeader', () => {
    const { res } = makeRes();
    res.setHeader('X-Remove', 'yes');
    res.removeHeader('x-remove');
    expect(res.hasHeader('x-remove')).toBe(false);
  });

  it('setHeaders sets multiple', () => {
    const { res } = makeRes();
    res.setHeaders({ 'x-a': '1', 'x-b': '2' });
    expect(res.getHeader('x-a')).toBe('1');
    expect(res.getHeader('x-b')).toBe('2');
  });

  it('headers getter returns a copy', () => {
    const { res } = makeRes();
    const h = res.headers;
    h['x-injected'] = 'bad';
    expect(res.hasHeader('x-injected')).toBe(false);
  });
});

describe('Res cookies', () => {
  it('setCookie with default Path=/', () => {
    const { res } = makeRes();
    res.setCookie('session', 'abc');
    expect(res.cookies.length).toBe(1);
    expect(res.cookies[0]).toContain('session=abc');
    expect(res.cookies[0]).toContain('Path=/');
  });

  it('setCookie with all options', () => {
    const { res } = makeRes();
    const expires = new Date('2030-01-01');
    res.setCookie('tok', 'val', {
      maxAge: 3600,
      expires,
      path: '/api',
      domain: '.example.com',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      priority: 'high',
      partitioned: true,
    });
    const cookie = res.cookies[0];
    expect(cookie).toContain('tok=val');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).toContain('Expires=');
    expect(cookie).toContain('Path=/api');
    expect(cookie).toContain('Domain=.example.com');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=strict');
    expect(cookie).toContain('Priority=high');
    expect(cookie).toContain('Partitioned');
  });

  it('clearCookie sets maxAge=0 and expires epoch', () => {
    const { res } = makeRes();
    res.clearCookie('session');
    const cookie = res.cookies[0];
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Expires=');
  });

  it('getCookies returns a copy', () => {
    const { res } = makeRes();
    res.setCookie('a', '1');
    const cookies = res.getCookies();
    cookies.push('b=2');
    expect(res.cookies.length).toBe(1);
  });
});

describe('Res body methods', () => {
  it('json() sets Content-Type and data', () => {
    const { res, raw } = makeRes();
    res.json({ ok: true });
    expect(res.getHeader('content-type')).toBe('application/json');
    expect(res.data).toEqual({ ok: true });
    expect(raw.end).toHaveBeenCalled();
  });

  it('text() sets text/plain', () => {
    const { res } = makeRes();
    res.text('hello');
    expect(res.getHeader('content-type')).toBe('text/plain');
    expect(res.data).toBe('hello');
  });

  it('html() sets text/html', () => {
    const { res } = makeRes();
    res.html('<h1>Hi</h1>');
    expect(res.getHeader('content-type')).toBe('text/html');
  });

  it('send() sends raw data', () => {
    const { res, raw } = makeRes();
    res.send('raw');
    expect(raw.end).toHaveBeenCalled();
  });

  it('buffer() sets octet-stream', () => {
    const { res } = makeRes();
    const buf = Buffer.from('data');
    res.buffer(buf);
    expect(res.getHeader('content-type')).toBe('application/octet-stream');
    expect(res.data).toBe(buf);
  });

  it('buffer() base64 encodes for lambda', () => {
    const { res } = makeRes('lambda');
    res.buffer(Buffer.from('data'));
    expect(res.isBase64Encoded).toBe(true);
  });

  it('stream() throws for non-http source', () => {
    const { res } = makeRes('lambda');
    expect(() => res.stream(null as any)).toThrow('Not implemented');
  });

  it('stream() works for http source', () => {
    const { res } = makeRes('http');
    const stream = { pipe: vi.fn() };
    res.stream(stream as any, 'text/plain');
    expect(res.getHeader('content-type')).toBe('text/plain');
  });
});

describe('Res redirect', () => {
  it('sets status 302 and location header', () => {
    const { res } = makeRes();
    res.redirect('/new-location');
    expect(res.status).toBe(302);
    expect(res.getHeader('location')).toBe('/new-location');
    expect(res.isRedirect).toBe(true);
  });

  it('supports custom status code', () => {
    const { res } = makeRes();
    res.redirect('/moved', 301);
    expect(res.status).toBe(301);
  });
});

describe('Res notFound', () => {
  it('sets 404 and json error', () => {
    const { res } = makeRes();
    res.notFound('gone');
    expect(res.status).toBe(404);
  });
});

describe('Res error', () => {
  it('normalizes error via ApplicationError', () => {
    const { res } = makeRes();
    res.error(new Error('fail'));
    expect(res.status).toBe(500);
  });
});

describe('Res reset', () => {
  it('resets all state to defaults', () => {
    const { res } = makeRes();
    res.status = 404;
    res.setHeader('X-Test', 'val');
    res.json({ data: 1 });
    res.reset();
    expect(res.status).toBe(200);
    expect(res.hasHeader('x-test')).toBe(false);
  });
});

describe('Res ok', () => {
  it('returns true for 2xx statuses', () => {
    const { res } = makeRes();
    expect(res.ok).toBe(true);
    res.status = 201;
    expect(res.ok).toBe(true);
    res.status = 204;
    expect(res.ok).toBe(true);
  });

  it('returns false for non-2xx', () => {
    const { res } = makeRes();
    res.status = 400;
    expect(res.ok).toBe(false);
    res.status = 500;
    expect(res.ok).toBe(false);
  });
});

describe('Res toJSON', () => {
  it('serializes to plain object', () => {
    const { res } = makeRes();
    res.json({ ok: true });
    const json = res.toJSON();
    expect(json.statusCode).toBe(200);
    expect(json.source).toBe('http');
    expect(json.data).toEqual({ ok: true });
  });
});

describe('Res data setter', () => {
  it('sets plain data directly', () => {
    const { res } = makeRes();
    res.data = 'hello';
    expect(res.data).toBe('hello');
  });

  it('normalizes Error via ApplicationError', () => {
    const { res } = makeRes();
    res.data = new Error('test');
    expect(res.status).toBe(500);
    expect(typeof res.data).toBe('object');
  });

  it('keeps ok status if already non-ok when setting Error', () => {
    const { res } = makeRes();
    res.status = 400;
    res.data = new Error('test');
    expect(res.status).toBe(400);
  });
});
