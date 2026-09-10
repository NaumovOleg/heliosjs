import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, Post, RateLimit } from '@heliosjs/core';
import { Cors } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E @Cors decorator', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('echoes an allowed origin', async () => {
    @Controller('/c')
    class C {
      @Cors({ origin: 'https://ok.test' })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`, { headers: { origin: 'https://ok.test' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://ok.test');
  });

  it('rejects a disallowed origin with 403', async () => {
    @Controller('/c')
    class C {
      @Cors({ origin: 'https://ok.test' })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`, { headers: { origin: 'https://evil.test' } });
    expect(res.status).toBe(403);
  });

  it('a same-origin (no Origin header) request is unaffected', async () => {
    @Controller('/c')
    class C {
      @Cors({ origin: 'https://ok.test' })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/c`)).status).toBe(200);
  });

  it('controller @Cors and method @Cors are AND-combined (stricter wins)', async () => {
    @Cors({ origin: '*' })
    @Controller('/c')
    class C {
      @Cors({ origin: 'https://only.test' })
      @Get('/strict') strict() { return {}; }

      @Get('/open') open() { return {}; }
    }
    ctx = await startE2E([C]);
    // method route: controller '*' AND method 'only.test' -> evil rejected
    expect((await fetch(`${ctx.base}/c/strict`, { headers: { origin: 'https://evil.test' } })).status).toBe(403);
    expect((await fetch(`${ctx.base}/c/strict`, { headers: { origin: 'https://only.test' } })).status).toBe(200);
    // sibling route: only the controller '*' applies
    expect((await fetch(`${ctx.base}/c/open`, { headers: { origin: 'https://anything.test' } })).status).toBe(200);
  });

  it('server-level cors preflight returns optionsSuccessStatus with echoed method/headers', async () => {
    @Controller('/api')
    class C {
      @Get('/') h() { return {}; }
    }
    ctx = await startE2E([C], {
      cors: { origin: '*', methods: ['GET', 'POST'], optionsSuccessStatus: 204 },
    });
    const res = await fetch(`${ctx.base}/api`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://x.test',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-custom',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('x-custom');
  });
});

describe('E2E @RateLimit decorator', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('allows up to `max` then returns 429 with headers', async () => {
    @Controller('/rl1')
    class C {
      @RateLimit({ max: 2, windowMs: 60_000 })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const r1 = await fetch(`${ctx.base}/rl1`, { headers: { 'user-agent': 'rl1-client' } });
    const r2 = await fetch(`${ctx.base}/rl1`, { headers: { 'user-agent': 'rl1-client' } });
    const r3 = await fetch(`${ctx.base}/rl1`, { headers: { 'user-agent': 'rl1-client' } });
    expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 429]);
    expect(r1.headers.get('x-ratelimit-limit')).toBe('2');
    expect(r3.headers.get('retry-after')).not.toBeNull();
  });

  it('counts each fingerprint (client) separately', async () => {
    @Controller('/rl2')
    class C {
      @RateLimit({ max: 1, windowMs: 60_000 })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/rl2`, { headers: { 'user-agent': 'A' } })).status).toBe(200);
    expect((await fetch(`${ctx.base}/rl2`, { headers: { 'user-agent': 'A' } })).status).toBe(429);
    // different UA -> different fingerprint -> its own budget
    expect((await fetch(`${ctx.base}/rl2`, { headers: { 'user-agent': 'B' } })).status).toBe(200);
  });

  it('method-level @RateLimit overrides controller-level', async () => {
    @RateLimit({ max: 5, windowMs: 60_000 })
    @Controller('/rl3')
    class C {
      @RateLimit({ max: 1, windowMs: 60_000 })
      @Get('/tight') tight() { return { ok: true }; }

      @Get('/loose') loose() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const ua = { 'user-agent': 'rl3-client' };
    expect((await fetch(`${ctx.base}/rl3/tight`, { headers: ua })).status).toBe(200);
    expect((await fetch(`${ctx.base}/rl3/tight`, { headers: ua })).status).toBe(429);
    // loose route uses the controller budget of 5
    for (let i = 0; i < 5; i++) {
      expect((await fetch(`${ctx.base}/rl3/loose`, { headers: ua })).status).toBe(200);
    }
    expect((await fetch(`${ctx.base}/rl3/loose`, { headers: ua })).status).toBe(429);
  });

  it('rejects a non-positive max at decoration time', () => {
    expect(() => {
      class C {
        // @ts-expect-error runtime validation under test
        @RateLimit({ max: 0, windowMs: 1000 })
        h() {}
      }
      return C;
    }).toThrow(TypeError);
  });

  it('a 429 skips @Catch-less handling and is the final response', async () => {
    @Controller('/rl4')
    class C {
      @RateLimit({ max: 1, windowMs: 60_000 })
      @Post('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const ua = { 'user-agent': 'rl4', 'content-type': 'application/json' };
    await fetch(`${ctx.base}/rl4`, { method: 'POST', headers: ua, body: '{}' });
    const blocked = await fetch(`${ctx.base}/rl4`, { method: 'POST', headers: ua, body: '{}' });
    expect(blocked.status).toBe(429);
  });
});
