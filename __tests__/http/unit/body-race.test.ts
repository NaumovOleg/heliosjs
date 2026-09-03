import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, vi, afterAll } from 'vitest';
import { collectRawBody } from '../../../src/http/src/utils/http/body';
import http from 'node:http';
import { PassThrough } from 'node:stream';

function makeStream(body?: string, headers?: Record<string, string>) {
  const req = new PassThrough() as unknown as http.IncomingMessage;
  const h: Record<string, string> = { 'content-length': '5', ...headers };
  Object.defineProperty(req, 'headers', { value: h });
  Object.defineProperty(req, 'method', { value: 'GET' });
  Object.defineProperty(req, 'url', { value: '/' });
  Object.defineProperty(req, 'httpVersion', { value: '1.1' });
  Object.defineProperty(req, 'socket', { value: { remoteAddress: '127.0.0.1' } });
  Object.defineProperty(req, 'destroy', { value: vi.fn() });
  if (body) { req.write(body); req.end(); }
  return req;
}

describe('body.ts - done flag race conditions', () => {
  it('collectRawBody: fail called after done returns early', async () => {
    const pt = new PassThrough();
    const req = Object.assign(pt, {
      headers: { 'content-length': '100' },
      destroy: vi.fn(),
    }) as unknown as http.IncomingMessage;
    const p = collectRawBody(req, 10);
    pt.write(Buffer.alloc(11));
    await expect(p).rejects.toThrow();
  });

  it('collectRawBody: data after done (error already fired)', async () => {
    const pt = new PassThrough();
    const req = Object.assign(pt, {
      headers: {},
      destroy: vi.fn(),
    }) as unknown as http.IncomingMessage;
    const p = collectRawBody(req, 10);
    pt.write(Buffer.alloc(11));
    await expect(p).rejects.toThrow();
    pt.write(Buffer.from('late'));
    pt.end();
  });

  it('collectRawBody: error after done returns early', async () => {
    const pt = new PassThrough();
    const req = Object.assign(pt, {
      headers: { 'content-length': '200' },
      destroy: vi.fn(),
    }) as unknown as http.IncomingMessage;
    pt.on('error', () => {});
    const p = collectRawBody(req, 5);
    pt.write(Buffer.alloc(6));
    await expect(p).rejects.toThrow();
    pt.emit('error', new Error('late'));
  });

  it('collectRawBody: successful read', async () => {
    const req = makeStream('hello');
    const buf = await collectRawBody(req);
    expect(buf.toString()).toBe('hello');
  });
});
