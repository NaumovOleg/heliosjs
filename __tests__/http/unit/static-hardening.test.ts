import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { staticMiddleware } from '../../../src/http/src/utils/http/static';

function makeReq(url: string, method = 'GET', headers: Record<string, any> = {}): any {
  return { method, url, headers };
}

function makeRes(raw: any = new PassThrough()): any {
  const res: any = {
    status: 200,
    headers: {},
    headersSent: false,
    raw,
  };
  res.setHeader = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
  });
  res.getHeader = vi.fn((key: string) => res.headers[key]);
  res.end = vi.fn(() => {
    res.headersSent = true;
  });
  return res;
}

let tmpDir: string;
let outsideDir: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'helios-static-hardening-'));
  outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'helios-static-outside-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.rm(outsideDir, { recursive: true, force: true });
});

describe('staticMiddleware hardening', () => {
  it('serves files under a mount path with a trailing slash', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'app.css'), 'body{}');
    const mw = staticMiddleware(tmpDir, { path: '/assets/' });
    const res = makeRes();
    const next = vi.fn();

    await mw(makeReq('/assets/app.css'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('text/css');
  });

  it('falls through on malformed percent-encoding', async () => {
    const mw = staticMiddleware(tmpDir);
    const next = vi.fn();

    await mw(makeReq('/%E0%A4%A'), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('falls through when the final realpath fails', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'file.txt'), 'data');
    const realpath = fs.promises.realpath.bind(fs.promises);
    vi.spyOn(fs.promises, 'realpath')
      .mockImplementationOnce((value: any) => realpath(value))
      .mockImplementationOnce((value: any) => realpath(value))
      .mockRejectedValueOnce(new Error('gone'));
    const mw = staticMiddleware(tmpDir);
    const next = vi.fn();

    await mw(makeReq('/file.txt'), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects an index file that symlinks outside the root', async () => {
    const sub = path.join(tmpDir, 'sub');
    await fs.promises.mkdir(sub);
    await fs.promises.writeFile(path.join(outsideDir, 'index.html'), 'secret');
    await fs.promises.symlink(path.join(outsideDir, 'index.html'), path.join(sub, 'index.html'));

    const mw = staticMiddleware(tmpDir);
    const res = makeRes();
    const next = vi.fn();

    await mw(makeReq('/sub'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.end).toHaveBeenCalledWith('Forbidden');
  });

  it('rejects a dotfile reached through the index fallback', async () => {
    const sub = path.join(tmpDir, 'sub');
    await fs.promises.mkdir(sub);
    await fs.promises.writeFile(path.join(sub, '.secret'), 'hidden');

    const mw = staticMiddleware(tmpDir, { index: '.secret', dotfiles: 'deny' });
    const res = makeRes();
    const next = vi.fn();

    await mw(makeReq('/sub'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it('responds with 500 when a range stream errors and fallthrough is off', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'range.txt'), '0123456789');
    vi.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const stream = new Readable({ read() {} });
      queueMicrotask(() => stream.emit('error', new Error('read failed')));
      return stream as any;
    });

    const mw = staticMiddleware(tmpDir, { fallthrough: false });
    const res = makeRes();
    const next = vi.fn();

    await mw(makeReq('/range.txt', 'GET', { range: 'bytes=0-1' }), res, next);

    expect(res.status).toBe(500);
    expect(res.end).toHaveBeenCalledWith('Internal Server Error');
  });

  it('pipes to the response itself when no raw transport is present', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'plain.txt'), 'plain');

    const sink = new PassThrough();
    const res: any = Object.assign(sink, {
      status: 200,
      headers: {},
      headersSent: false,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    });
    const received = new Promise<Buffer>((resolve) => sink.once('data', resolve));

    const mw = staticMiddleware(tmpDir);
    await mw(makeReq('/plain.txt'), res, vi.fn());

    expect((await received).toString()).toBe('plain');
  });
});
