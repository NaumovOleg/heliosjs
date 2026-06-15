import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { UseFingerprint } from '@heliosjs/middlewares';
import { reflectMiddlewaresMetadata, setFingerprintConfig } from '@heliosjs/core/utils';
import type { MiddlewareCB, Request } from '@heliosjs/core/types';

function makeReq(
  opts: { ip?: string; userAgent?: string; headers?: Record<string, string | string[]> } = {},
): Request {
  const state = new Map<string, unknown>();
  const headers = opts.headers ?? {};
  return {
    userAgent: opts.userAgent ?? '',
    getClientIp: () => opts.ip ?? '',
    getHeader: (name: string) => headers[name.toLowerCase()],
    getState: <T>(key: string) => state.get(key) as T | undefined,
    setState: (key: string, value: unknown) => {
      state.set(key, value);
    },
  } as unknown as Request;
}

afterEach(() => setFingerprintConfig(undefined));

describe('UseFingerprint decorator', () => {
  it('registers a middleware that attaches the fingerprint and calls next', async () => {
    class Ctrl {}
    UseFingerprint()(Ctrl);

    const meta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(meta.length).toBe(1);
    const mw = meta[0].middleware as MiddlewareCB;

    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    let nextCalled = false;
    await mw(req, {} as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.getState('fingerprint')).toBe(
      createHash('sha256').update('1.1.1.1|UA|en').digest('hex'),
    );
  });

  it('applies a per-decorator component override', async () => {
    class Ctrl {}
    UseFingerprint({ components: ['userAgent'] })(Ctrl);

    const mw = (reflectMiddlewaresMetadata(Ctrl) ?? [])[0].middleware as MiddlewareCB;
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    await mw(req, {} as never, () => {});

    expect(req.getState('fingerprint')).toBe(createHash('sha256').update('UA').digest('hex'));
  });

  it('registers on a method when applied at method level', () => {
    class Ctrl {
      handler() {}
    }
    UseFingerprint()(Ctrl.prototype, 'handler');

    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler') ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].middleware).toBe('function');
  });
});
