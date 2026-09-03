import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { staticMiddleware } from '../../../src/http/src/utils/http/static';

function makeReq(overrides: any = {}) {
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
  } as any;
}

function makeRes() {
  const headers: Record<string, string | string[]> = {};
  const rawRes: any = {
    end: vi.fn(),
    setHeader: vi.fn((n: string, v: string | string[]) => { headers[n] = v; }),
    headersSent: false,
    statusCode: 200,
  };
  return {
    status: 200,
    data: undefined,
    setHeader: rawRes.setHeader,
    getHeader: (n: string) => headers[n],
    headers,
    raw: rawRes,
    end: vi.fn(),
  } as any;
}

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'helios-static-test-'));
  await fs.promises.mkdir(path.join(tmpDir, 'subdir'), { recursive: true });
  await fs.promises.writeFile(path.join(tmpDir, 'index.html'), '<h1>Hello</h1>');
  await fs.promises.writeFile(path.join(tmpDir, 'style.css'), 'body{}');
  await fs.promises.writeFile(path.join(tmpDir, '.hidden'), 'secret');
  await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
  await fs.promises.mkdir(path.join(tmpDir, 'emptydir'));
});

afterAll(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe('staticMiddleware coverage', () => {
  it('non-GET/HEAD request falls through', async () => {
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ method: 'POST', url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('HEAD request returns 200 with no body', async () => {
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ method: 'HEAD', url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(200);
  });

  it('serves index.html for directory', async () => {
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ url: '/' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Content-Type']).toBe('text/html');
  });

  it('directory without index falls through', async () => {
    const mw = staticMiddleware(tmpDir, { index: false });
    const req = makeReq({ url: '/emptydir' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('extension fallback', async () => {
    const mw = staticMiddleware(tmpDir, { extensions: ['html'] });
    const req = makeReq({ url: '/index' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Content-Type']).toBeDefined();
  });

  it('dotfiles deny returns 403', async () => {
    const mw = staticMiddleware(tmpDir, { dotfiles: 'deny' });
    const req = makeReq({ url: '/.hidden' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(403);
  });

  it('immutable cache-control', async () => {
    const mw = staticMiddleware(tmpDir, { immutable: true, maxAge: 3600 });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('maxAge cache-control', async () => {
    const mw = staticMiddleware(tmpDir, { maxAge: 3600 });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600');
  });

  it('no-cache default', async () => {
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Cache-Control']).toBe('no-cache');
  });

  it('acceptRanges header', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Accept-Ranges']).toBe('bytes');
  });

  it('no acceptRanges when disabled', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: false });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Accept-Ranges']).toBeUndefined();
  });

  it('setHeaders callback', async () => {
    const setHeaders = vi.fn();
    const mw = staticMiddleware(tmpDir, { setHeaders });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(setHeaders).toHaveBeenCalled();
  });

  it('range request returns 206', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt', headers: { range: 'bytes=0-2' } });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(206);
  });

  it('invalid range falls through to full response', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt', headers: { range: 'bytes=999-999' } });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(200);
  });

  it('malformed range falls through', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt', headers: { range: 'invalid' } });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(200);
  });

  it('path traversal attempt returns 403', async () => {
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ url: '/../../../etc/passwd' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(403);
  });

  it('non-root path serves correct file', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'subdir', 'file.txt'), 'sub file');
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ url: '/subdir/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Content-Type']).toBe('text/plain');
  });

  it('array range header', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt', headers: { range: ['bytes=0-2'] } });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(206);
  });

  it('fallthrough false keeps serving', async () => {
    const mw = staticMiddleware(tmpDir, { fallthrough: false });
    const req = makeReq({ url: '/file.txt' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('range without end byte', async () => {
    const mw = staticMiddleware(tmpDir, { acceptRanges: true });
    const req = makeReq({ url: '/file.txt', headers: { range: 'bytes=0-' } });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toBe(206);
  });

  it('unknown MIME type uses octet-stream', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.xyz'), 'data');
    const mw = staticMiddleware(tmpDir);
    const req = makeReq({ url: '/file.xyz' });
    const res = makeRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.headers['Content-Type']).toBe('application/octet-stream');
  });
});
