import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { collectRawBody, DEFAULT_BODY_LIMIT } from '../../../src/http/src/utils/http/body';
import { PayloadTooLargeError } from '@heliosjs/core/utils';

function createMockReq(headers: Record<string, string> = {}, body?: string) {
  const req = new http.IncomingMessage(new net.Socket() as any);
  Object.assign(req, { headers });
  return req;
}

import net from 'node:net';

function fakeReq(headers: Record<string, string> = {}, chunks: Buffer[] = []) {
  const socket = new net.Socket();
  const req = new http.IncomingMessage(socket as any);
  (req as any).headers = headers;
  return { req, socket, chunks };
}

describe('collectRawBody', () => {
  it('collects empty body', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    // Emit end immediately
    setTimeout(() => req.emit('end'), 0);
    const body = await collectRawBody(req);
    expect(body.length).toBe(0);
  });

  it('collects body chunks', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    setTimeout(() => {
      req.emit('data', Buffer.from('hello'));
      req.emit('data', Buffer.from(' world'));
      req.emit('end');
    }, 0);
    const body = await collectRawBody(req);
    expect(body.toString()).toBe('hello world');
  });

  it('rejects when content-length exceeds limit', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = { 'content-length': '999999' };
    await expect(collectRawBody(req, 100)).rejects.toThrow(PayloadTooLargeError);
  });

  it('rejects when body exceeds maxBytes', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    setTimeout(() => {
      req.emit('data', Buffer.alloc(200));
      req.emit('end');
    }, 0);
    await expect(collectRawBody(req, 100)).rejects.toThrow(PayloadTooLargeError);
  });

  it('allows unlimited body when maxBytes is 0', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    setTimeout(() => {
      req.emit('data', Buffer.alloc(10000));
      req.emit('end');
    }, 0);
    const body = await collectRawBody(req, 0);
    expect(body.length).toBe(10000);
  });

  it('allows unlimited body when maxBytes is Infinity', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    setTimeout(() => {
      req.emit('data', Buffer.alloc(10000));
      req.emit('end');
    }, 0);
    const body = await collectRawBody(req, Infinity);
    expect(body.length).toBe(10000);
  });

  it('rejects on stream error', async () => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket as any);
    (req as any).headers = {};
    setTimeout(() => {
      req.emit('error', new Error('stream error'));
    }, 0);
    await expect(collectRawBody(req)).rejects.toThrow('stream error');
  });

  it('DEFAULT_BODY_LIMIT is 1MB', () => {
    expect(DEFAULT_BODY_LIMIT).toBe(1_048_576);
  });
});
