import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  getFingerprintConfig,
  getOrComputeFingerprint,
  setFingerprintConfig,
} from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';
import { Fingerprint } from '@heliosjs/core';
import { reflectRouteMetadata } from '@heliosjs/core/utils';

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

describe('computeFingerprint', () => {
  it('hashes default components (ip|userAgent|acceptLanguage) with sha256', () => {
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const expected = createHash('sha256').update('1.1.1.1|UA|en').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('is stable for identical requests and differs for different ones', () => {
    const a = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const b = makeReq({ ip: '2.2.2.2', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    expect(computeFingerprint(a)).toBe(computeFingerprint(makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } })));
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b));
  });

  it('honors a per-call component override', () => {
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    const expected = createHash('sha256').update('UA').digest('hex');
    expect(computeFingerprint(req, ['userAgent'])).toBe(expected);
  });

  it('honors global components config when no override', () => {
    setFingerprintConfig({ components: ['userAgent'] });
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    const expected = createHash('sha256').update('UA').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('uses HMAC-SHA-256 when a secret is configured', () => {
    setFingerprintConfig({ secret: 's3cr3t' });
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const expected = createHmac('sha256', 's3cr3t').update('1.1.1.1|UA|en').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('uses a custom compute override verbatim', () => {
    setFingerprintConfig({ compute: () => 'CUSTOM' });
    expect(computeFingerprint(makeReq())).toBe('CUSTOM');
  });

  it('compute override takes precedence over per-call components', () => {
    setFingerprintConfig({ compute: () => 'CUSTOM' });
    expect(computeFingerprint(makeReq({ userAgent: 'UA' }), ['userAgent'])).toBe('CUSTOM');
  });

  it('normalizes array headers and treats missing components as empty', () => {
    const req = makeReq({ ip: '1.1.1.1', headers: { 'accept-language': ['en', 'fr'] } });
    const expected = createHash('sha256').update('1.1.1.1||en,fr').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });
});

describe('getOrComputeFingerprint', () => {
  it('computes once and caches in request state', () => {
    let calls = 0;
    setFingerprintConfig({ compute: () => { calls++; return 'v'; } });
    const req = makeReq();
    expect(getOrComputeFingerprint(req)).toBe('v');
    expect(getOrComputeFingerprint(req)).toBe('v');
    expect(calls).toBe(1);
    expect(req.getState('fingerprint')).toBe('v');
  });

  it('a later default read returns the value seeded by an earlier override', () => {
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const seeded = getOrComputeFingerprint(req, ['userAgent']); // seeds cache (UseFingerprint path)
    expect(seeded).toBe(createHash('sha256').update('UA').digest('hex'));
    // @Fingerprint() param path: no override, must return the cached seeded value
    expect(getOrComputeFingerprint(req)).toBe(seeded);
  });
});

describe('fingerprint config holder', () => {
  it('is undefined before set, returns after set, clears on undefined', () => {
    expect(getFingerprintConfig()).toBeUndefined();
    const cfg = { secret: 's' };
    setFingerprintConfig(cfg);
    expect(getFingerprintConfig()).toBe(cfg);
    setFingerprintConfig(undefined);
    expect(getFingerprintConfig()).toBeUndefined();
  });
});

describe('Fingerprint param decorator', () => {
  it('records a "fingerprint" param at the decorated index', () => {
    class Ctrl {
      handler(_fp: string) {}
    }
    Fingerprint()(Ctrl.prototype, 'handler', 0);

    const meta = reflectRouteMetadata(Ctrl.prototype, 'handler');
    const param = meta.parameters.find((p) => p.index === 0);
    expect(param?.type).toBe('fingerprint');
  });
});
