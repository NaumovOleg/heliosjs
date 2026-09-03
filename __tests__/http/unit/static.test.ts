import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Readable, PassThrough } from 'node:stream';
import { staticMiddleware } from '../../../src/http/src/utils/http/static';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function makeReq(url: string, method = 'GET', headers: Record<string, any> = {}): any {
  return { method, url, headers, socket: { remoteAddress: '127.0.0.1' } };
}

function makeRes(): any {
  const pt = new PassThrough();
  pt.on('error', () => {});
  const res: any = {
    status: 200,
    headers: {},
    headersSent: false,
    raw: pt,
  };
  res.setHeader = vi.fn((key: string, value: string) => { res.headers[key] = value; });
  res.getHeader = vi.fn((key: string) => res.headers[key]);
  res.end = vi.fn((..._args: any[]) => { res.headersSent = true; });
  return res;
}

let tmpDir: string;
let realRoot: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'helios-static-test-'));
  realRoot = await fs.promises.realpath(tmpDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe('staticMiddleware', () => {
  it('calls next for non-GET/HEAD methods', async () => {
    const next = vi.fn();
    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/test', 'POST'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when root path does not exist', async () => {
    const next = vi.fn();
    const mw = staticMiddleware('/nonexistent/path');
    await mw(makeReq('/test'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when file not found', async () => {
    const next = vi.fn();
    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/missing.html'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('serves a file', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'hello.txt'), 'hello world');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('hello world'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/hello.txt'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('text/plain');
    expect(res.headers['Content-Length']).toBe('11');
    expect(res.headers['Last-Modified']).toBeDefined();
  });

  it('sets no-cache when maxAge is 0', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { maxAge: 0 });
    await mw(makeReq('/file.txt'), res, next);
    expect(res.headers['Cache-Control']).toBe('no-cache');
  });

  it('sets immutable cache', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { immutable: true });
    await mw(makeReq('/file.txt'), res, next);
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('sets max-age cache header', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { maxAge: 3600 });
    await mw(makeReq('/file.txt'), res, next);
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600');
  });

  it('sets accept-ranges header', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { maxAge: 0 } as any);
    await mw(makeReq('/file.txt'), res, next);
    expect(res.headers['Accept-Ranges']).toBe('bytes');
  });

  it('calls setHeaders callback', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);
    const setHeaders = vi.fn();

    const mw = staticMiddleware(realRoot, { setHeaders });
    await mw(makeReq('/file.txt'), res, next);
    expect(setHeaders).toHaveBeenCalled();
  });

  it('serves directory index when configured', async () => {
    await fs.promises.mkdir(path.join(tmpDir, 'subdir'));
    await fs.promises.writeFile(path.join(tmpDir, 'subdir', 'index.html'), '<h1>Index</h1>');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('<h1>Index</h1>'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { index: 'index.html' });
    await mw(makeReq('/subdir/'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when directory has no index file', async () => {
    await fs.promises.mkdir(path.join(tmpDir, 'subdir'));
    const next = vi.fn();
    const mw = staticMiddleware(realRoot, { index: 'index.html' });
    await mw(makeReq('/subdir/'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('resolves extension fallbacks', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'page.html'), '<p>page</p>');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('<p>page</p>'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot, { extensions: ['html'] });
    await mw(makeReq('/page'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('text/html');
  });

  it('denies dotfiles when dotfiles is deny', async () => {
    await fs.promises.writeFile(path.join(tmpDir, '.hidden'), 'secret');
    const next = vi.fn();
    const res = makeRes();
    const mw = staticMiddleware(realRoot, { dotfiles: 'deny' });
    await mw(makeReq('/.hidden'), res, next);
    expect(res.status).toBe(403);
  });

  it('forbids path traversal', async () => {
    const next = vi.fn();
    const res = makeRes();
    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/../etc/passwd'), res, next);
    expect(res.status).toBe(403);
  });

  it('returns 403 for dotfiles deny', async () => {
    await fs.promises.writeFile(path.join(tmpDir, '.env'), 'SECRET=key');
    const next = vi.fn();
    const res = makeRes();
    const mw = staticMiddleware(realRoot, { dotfiles: 'deny' });
    await mw(makeReq('/.env'), res, next);
    expect(res.status).toBe(403);
    expect(res.headers['Content-Type']).toBe('text/plain');
  });

  it('handles HEAD requests without body', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/file.txt', 'HEAD'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns unknown mime type as octet-stream', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.xyz'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/file.xyz'), res, next);
    expect(res.headers['Content-Type']).toBe('application/octet-stream');
  });

  it('handles URL encoded paths', async () => {
    const fileName = 'my file.txt';
    await fs.promises.writeFile(path.join(tmpDir, fileName), 'content');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('content'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/my%20file.txt'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('strips query string from url', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('data'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/file.txt?v=1'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('falls through on error when fallthrough is true', async () => {
    const next = vi.fn();
    const mw = staticMiddleware(realRoot, { fallthrough: true });
    await mw(makeReq('/test'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 500 when fallthrough is false and stream errors', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const readable = new Readable({ read() { this.destroy(new Error('stream fail')); } });
      return readable as any;
    });

    const mw = staticMiddleware(realRoot, { fallthrough: false });
    await mw(makeReq('/file.txt'), res, next).catch(() => {});
    expect(res.status).toBe(500);
  });

  it('handles range request', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'hello world');
    const next = vi.fn();
    const res = makeRes();
    vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push('hello'); this.push(null); } }) as any);

    const mw = staticMiddleware(realRoot);
    await mw(makeReq('/file.txt', 'GET', { range: 'bytes=0-4' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('serves MIME types correctly', async () => {
    const testCases: [string, string, string][] = [
      ['.html', '<h1>test</h1>', 'text/html'],
      ['.css', 'body{}', 'text/css'],
      ['.js', 'console.log()', 'application/javascript'],
      ['.json', '{}', 'application/json'],
      ['.png', 'fake-png', 'image/png'],
      ['.jpg', 'fake-jpg', 'image/jpeg'],
      ['.gif', 'fake-gif', 'image/gif'],
      ['.svg', '<svg></svg>', 'image/svg+xml'],
      ['.ico', 'ico', 'image/x-icon'],
      ['.txt', 'text', 'text/plain'],
      ['.pdf', 'pdf', 'application/pdf'],
      ['.woff', 'woff', 'font/woff'],
      ['.woff2', 'woff2', 'font/woff2'],
      ['.ttf', 'ttf', 'font/ttf'],
      ['.eot', 'eot', 'application/vnd.ms-fontobject'],
      ['.webp', 'webp', 'image/webp'],
      ['.mp4', 'mp4', 'video/mp4'],
      ['.mp3', 'mp3', 'audio/mpeg'],
      ['.xml', '<root/>', 'application/xml'],
      ['.zip', 'zip', 'application/zip'],
      ['.gz', 'gz', 'application/gzip'],
    ];

    for (const [ext, content, expectedMime] of testCases) {
      const fileName = `file${ext}`;
      await fs.promises.writeFile(path.join(tmpDir, fileName), content);
      const next = vi.fn();
      const res = makeRes();
      vi.spyOn(fs, 'createReadStream').mockReturnValue(new Readable({ read() { this.push(content); this.push(null); } }) as any);

      const mw = staticMiddleware(realRoot);
      await mw(makeReq(`/${fileName}`), res, next);
      expect(res.headers['Content-Type']).toBe(expectedMime);
      vi.restoreAllMocks();
    }
  });
});
