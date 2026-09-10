import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import * as Joi from 'joi';
import { Controller, Get, Post, Body } from '@heliosjs/core';
import { Use, Guard, Pipe, Intercept, Catch, Sanitize } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

/**
 * The middleware execution order. Helios buckets decorators by kind
 * (`buildCompiledMiddleware`) and runs the buckets in a fixed phase order,
 * regardless of the order the decorators are written in:
 *
 *   global (app.use) -> guards -> pipes -> @Use -> handler -> interceptors(reverse)
 *
 * Within one kind: controller-level before method-level (interceptors/errorHandlers
 * are collected in that order but executed reversed, so method runs first).
 */
describe('E2E middleware: execution order', () => {
  let ctx: E2EApp;
  let log: string[];
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('runs kinds in phase order: global -> guard -> pipe -> @Use -> handler -> interceptor', async () => {
    log = [];
    @Controller('/x')
    class C {
      // deliberately written in an order that does NOT match execution order
      @Intercept((d) => { log.push('intercept'); return d; })
      @Use((_r: never, _s: never, n: () => void) => { log.push('use'); n(); })
      @Pipe({ body: (b: unknown) => { log.push('pipe'); return b; } })
      @Guard(() => { log.push('guard'); return true; })
      @Get('/')
      h() { log.push('handler'); return { ok: true }; }
    }
    ctx = await startE2E([C]);
    (ctx.app as unknown as { use: (m: unknown) => void }).use(
      async (_r: never, _s: never, n: () => Promise<void>) => { log.push('global'); await n(); }
    );

    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['global', 'guard', 'pipe', 'use', 'handler', 'intercept']);
  });

  it('phase order is stable when the decorators are re-ordered', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Guard(() => { log.push('guard'); return true; })
      @Pipe({ body: (b: unknown) => { log.push('pipe'); return b; } })
      @Use((_r: never, _s: never, n: () => void) => { log.push('use'); n(); })
      @Intercept((d) => { log.push('intercept'); return d; })
      @Get('/')
      h() { log.push('handler'); return { ok: true }; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['guard', 'pipe', 'use', 'handler', 'intercept']);
  });

  it('@Use above @Guard still runs after the guard (kind wins over source order)', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Use((_r: never, _s: never, n: () => void) => { log.push('use'); n(); })
      @Guard(() => { log.push('guard'); return true; })
      @Get('/')
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['guard', 'use', 'handler']);
  });

  it('controller-level @Use runs before method-level @Use', async () => {
    log = [];
    @Use((_r: never, _s: never, n: () => void) => { log.push('ctrl'); n(); })
    @Controller('/x')
    class C {
      @Use((_r: never, _s: never, n: () => void) => { log.push('method'); n(); })
      @Get('/')
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['ctrl', 'method', 'handler']);
  });

  it('multiple @Use run top-to-bottom', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Use((_r: never, _s: never, n: () => void) => { log.push('first'); n(); })
      @Use((_r: never, _s: never, n: () => void) => { log.push('second'); n(); })
      @Get('/')
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['first', 'second', 'handler']);
  });

  it('route-array middlewares run before method @Use', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Use((_r: never, _s: never, n: () => void) => { log.push('use'); n(); })
      @Get('/', [(_r: never, _s: never, n: () => void) => { log.push('arr'); n(); }])
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['arr', 'use', 'handler']);
  });

  // Fixed (was B12): `@Get('/', [a, b])` now runs a before b.
  it('route-array middlewares run in the array order given', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Get('/', [
        (_r: never, _s: never, n: () => void) => { log.push('arr1'); n(); },
        (_r: never, _s: never, n: () => void) => { log.push('arr2'); n(); },
      ])
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['arr1', 'arr2', 'handler']);
  });

  it('multiple @Intercept run nearest-handler-first and compose', async () => {
    @Controller('/x')
    class C {
      @Intercept((d: { seen: string[] }) => ({ seen: [...d.seen, 'outer'] }))
      @Intercept((d: { seen: string[] }) => ({ seen: [...d.seen, 'inner'] }))
      @Get('/')
      h() { return { seen: ['handler'] }; }
    }
    ctx = await startE2E([C]);
    const data = await fetch(`${ctx.base}/x`).then((r) => r.json());
    expect(data.seen).toEqual(['handler', 'inner', 'outer']);
  });

  it('method @Intercept runs before controller @Intercept', async () => {
    @Intercept((d: { seen: string[] }) => ({ seen: [...d.seen, 'ctrl'] }))
    @Controller('/y')
    class D {
      @Intercept((d: { seen: string[] }) => ({ seen: [...d.seen, 'method'] }))
      @Get('/')
      h() { return { seen: ['handler'] }; }
    }
    ctx = await startE2E([D]);
    const data = await fetch(`${ctx.base}/y`).then((r) => r.json());
    expect(data.seen).toEqual(['handler', 'method', 'ctrl']);
  });

  it('multiple @Catch run nearest-handler-first', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Catch((e: Error) => { log.push('outer'); return e; })
      @Catch((e: Error) => { log.push('inner'); return e; })
      @Get('/')
      h(): never { throw new Error('boom'); }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`);
    expect(log).toEqual(['inner', 'outer']);
  });

  it('sanitizers run before guards (guard sees the sanitized value)', async () => {
    let seenByGuard: unknown;
    @Controller('/x')
    class C {
      @Sanitize({ type: 'body', schema: Joi.object({ name: Joi.string().trim() }) })
      @Guard((req: { body?: { name?: string } }) => {
        seenByGuard = req.body?.name;
        return true;
      })
      @Post('/')
      h(@Body() body: { name: string }) { return { name: body.name }; }
    }
    ctx = await startE2E([C]);
    await fetch(`${ctx.base}/x`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  alice  ' }),
    });
    expect(seenByGuard).toBe('alice');
  });

  it('pipes run after guards (a blocking guard prevents the pipe)', async () => {
    log = [];
    @Controller('/x')
    class C {
      @Guard(() => { log.push('guard'); return false; })
      @Pipe({ body: (b: unknown) => { log.push('pipe'); return b; } })
      @Post('/')
      h() { log.push('handler'); return {}; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/x`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
    expect(log).toEqual(['guard']);
  });
});
