import { describe, expect, it } from 'vitest';
import { parseQuery, parseBody, parseRequestCookie, parseHeaders } from '@heliosjs/core/utils';

describe('parseQuery', () => {
  it('parses simple query params', () => {
    const url = new URL('http://localhost?page=1&search=test');
    expect(parseQuery(url)).toEqual({ page: '1', search: 'test' });
  });

  it('handles duplicate keys as array', () => {
    const url = new URL('http://localhost?tag=a&tag=b');
    const q = parseQuery(url);
    expect(q.tag).toEqual(['a', 'b']);
  });

  it('returns empty object for no query', () => {
    expect(parseQuery(new URL('http://localhost'))).toEqual({});
  });

  it('handles encoded values', () => {
    const url = new URL('http://localhost?q=hello%20world');
    expect(parseQuery(url)).toEqual({ q: 'hello world' });
  });
});

describe('parseBody', () => {
  it('returns object body directly', () => {
    const body = { name: 'John' };
    expect(parseBody({ body, headers: {} })).toBe(body);
  });

  it('parses JSON string body', () => {
    const result = parseBody({
      body: '{"name":"John"}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ name: 'John' });
  });

  it('returns string on invalid JSON', () => {
    const result = parseBody({
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toBe('not-json');
  });

  it('parses text body', () => {
    const result = parseBody({
      body: 'hello',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(result).toBe('hello');
  });

  it('parses urlencoded body', () => {
    const result = parseBody({
      body: 'name=John&age=30',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(result).toEqual({ name: 'John', age: '30' });
  });

  it('handles duplicate keys in urlencoded', () => {
    const result = parseBody({
      body: 'tag=a&tag=b',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(result).toEqual({ tag: ['a', 'b'] });
  });

  it('returns raw for invalid urlencoded', () => {
    const result = parseBody({
      body: '\x00\x08',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(result).toBeDefined();
  });

  it('parses XML body as string', () => {
    const result = parseBody({
      body: '<root>data</root>',
      headers: { 'Content-Type': 'application/xml' },
    });
    expect(result).toBe('<root>data</root>');
  });

  it('parses text/xml body', () => {
    const result = parseBody({
      body: '<root/>',
      headers: { 'Content-Type': 'text/xml' },
    });
    expect(result).toBe('<root/>');
  });

  it('returns multipart indicator for multipart content', () => {
    const result = parseBody({
      body: 'binary-data',
      headers: { 'Content-Type': 'multipart/form-data; boundary=abc' },
    });
    expect(result).toEqual({ multipart: true, contentType: 'multipart/form-data; boundary=abc', body: 'binary-data' });
  });

  it('decodes base64 body', () => {
    const encoded = Buffer.from('hello').toString('base64');
    const result = parseBody({
      body: encoded,
      headers: { 'Content-Type': 'text/plain' },
      isBase64Encoded: true,
    });
    expect(result).toBe('hello');
  });

  it('converts Buffer body to string', () => {
    const result = parseBody({
      body: Buffer.from('data'),
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(result).toBe('data');
  });

  it('handles array content-type', () => {
    const result = parseBody({
      body: '{"x":1}',
      headers: { 'Content-Type': ['application/json'] },
    });
    expect(result).toEqual({ x: 1 });
  });

  it('returns undefined for empty body', () => {
    expect(parseBody({ body: undefined, headers: {} })).toBeUndefined();
    expect(parseBody({ body: null, headers: {} })).toBeUndefined();
  });

  it('handles BOM in body', () => {
    const body = '\ufeff{"x":1}';
    const result = parseBody({
      body,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ x: 1 });
  });

  it('strips control characters', () => {
    const body = '\x00{"name":"John"}';
    const result = parseBody({
      body,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ name: 'John' });
  });

  it('returns raw buffer as string for unknown type', () => {
    const result = parseBody({
      body: Buffer.from('raw'),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    expect(result).toBe('raw');
  });

  it('returns body for unknown content type', () => {
    const result = parseBody({
      body: 'something',
      headers: { 'Content-Type': 'unknown/type' },
    });
    expect(result).toBe('something');
  });
});

describe('parseRequestCookie', () => {
  it('parses cookie string', () => {
    expect(parseRequestCookie('session=abc; token=xyz')).toEqual({ session: 'abc', token: 'xyz' });
  });

  it('decodes URI encoded values', () => {
    expect(parseRequestCookie('data=hello%20world')).toEqual({ data: 'hello world' });
  });

  it('returns empty for undefined', () => {
    expect(parseRequestCookie(undefined)).toEqual({});
  });

  it('handles array of cookie strings', () => {
    const result = parseRequestCookie(['a=1', 'b=2']);
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('handles single cookie string as array', () => {
    const result = parseRequestCookie(['x=y']);
    expect(result).toEqual({ x: 'y' });
  });

  it('handles cookies without value', () => {
    const result = parseRequestCookie('empty; valid=1');
    expect(result).toEqual({ valid: '1' });
  });
});

describe('parseHeaders', () => {
  it('filters out undefined values', () => {
    const result = parseHeaders({ a: '1', b: undefined });
    expect(result).toEqual({ a: '1' });
  });

  it('returns empty object for undefined input', () => {
    expect(parseHeaders(undefined)).toEqual({});
  });

  it('preserves all defined values', () => {
    const result = parseHeaders({ 'x-custom': 'val', host: 'localhost' });
    expect(result).toEqual({ 'x-custom': 'val', host: 'localhost' });
  });
});
