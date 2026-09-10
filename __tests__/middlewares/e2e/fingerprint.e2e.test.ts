import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Fingerprint, Get, setFingerprintConfig } from '@heliosjs/core';
import { UseFingerprint } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

const fpOf = async (ctx: E2EApp, path: string, headers: Record<string, string>) =>
  (await fetch(`${ctx.base}${path}`, { headers }).then((r) => r.json())).fp as string;

describe('E2E fingerprint', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
    setFingerprintConfig(undefined);
  });

  it('@Fingerprint() is deterministic and varies with the default components', async () => {
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C]);
    const a = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'en' });
    const same = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'en' });
    const diffUa = await fpOf(ctx, '/f', { 'user-agent': 'OTHER', 'accept-language': 'en' });
    const diffLang = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'de' });
    expect(a).toBe(same);
    expect(a).not.toBe(diffUa);
    expect(a).not.toBe(diffLang);
  });

  it('@UseFingerprint({ components }) narrows the fingerprint for its scope', async () => {
    @UseFingerprint({ components: ['ip'] })
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C]);
    // only `ip` counts now, so differing UA / language collapse to one value
    const a = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'en' });
    const b = await fpOf(ctx, '/f', { 'user-agent': 'DIFFERENT', 'accept-language': 'zz' });
    expect(a).toBe(b);
  });

  it('@Server({ fingerprint: { components } }) sets the global default', async () => {
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C], { fingerprint: { components: ['userAgent'] } });
    const a = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'en' });
    const sameUaDiffLang = await fpOf(ctx, '/f', { 'user-agent': 'UA', 'accept-language': 'de' });
    const diffUa = await fpOf(ctx, '/f', { 'user-agent': 'NOPE', 'accept-language': 'en' });
    expect(a).toBe(sameUaDiffLang);
    expect(a).not.toBe(diffUa);
  });

  it('@Server({ fingerprint: { secret } }) switches to a keyed hash', async () => {
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C], { fingerprint: { components: ['userAgent'], secret: 's3cr3t' } });
    const keyed = await fpOf(ctx, '/f', { 'user-agent': 'UA' });
    await ctx.close();
    ctx = await startE2E([C], { fingerprint: { components: ['userAgent'] } });
    const plain = await fpOf(ctx, '/f', { 'user-agent': 'UA' });
    expect(keyed).not.toBe(plain);
    expect(keyed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the fingerprint is computed once per request and cached', async () => {
    // @UseFingerprint (middleware, override ['ip']) runs before @Fingerprint()
    // param resolution, so the param sees the cached ip-only value, not a fresh
    // default computation.
    @UseFingerprint({ components: ['ip'] })
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C]);
    const viaParam = await fpOf(ctx, '/f', { 'user-agent': 'X' });
    const ipOnlyControl = await (async () => {
      await ctx.close();
      ctx = await startE2E([C], { fingerprint: { components: ['ip'] } });
      return fpOf(ctx, '/f', { 'user-agent': 'TOTALLY-DIFFERENT' });
    })();
    expect(viaParam).toBe(ipOnlyControl);
  });
});
