import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Controller,
  Get,
  Post,
  Res,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  RateLimitExceededError,
} from '@heliosjs/core';
import { Intercept, Catch, Status, Ok201, Ok204, Pipe, Guard, Use } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E @Intercept', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('runs for every falsy handler return (undefined, null, 0)', async () => {
    const seen: unknown[] = [];
    @Controller('/i')
    class C {
      @Intercept((d) => { seen.push(d); return { fromInterceptor: true }; })
      @Get('/u') u() { return undefined; }
      @Intercept((d) => { seen.push(d); return { fromInterceptor: true }; })
      @Get('/n') n() { return null; }
      @Intercept((d) => { seen.push(d); return { fromInterceptor: true }; })
      @Get('/z') z() { return 0; }
    }
    ctx = await startE2E([C]);
    for (const p of ['u', 'n', 'z']) {
      const res = await fetch(`${ctx.base}/i/${p}`);
      expect(res.status, p).toBe(200);
      expect(await res.json(), p).toEqual({ fromInterceptor: true });
    }
    expect(seen).toEqual([undefined, null, 0]);
  });

  it('does not run when the handler throws', async () => {
    let ran = false;
    @Controller('/i')
    class C {
      @Intercept((d) => { ran = true; return d; })
      @Get('/') h(): never { throw new Error('boom'); }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/i`)).status).toBe(500);
    expect(ran).toBe(false);
  });

  it('does not run when the handler returns an Error', async () => {
    let ran = false;
    @Controller('/i')
    class C {
      @Intercept((d) => { ran = true; return d; })
      @Get('/') h() { return new Error('returned'); }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/i`)).status).toBe(500);
    expect(ran).toBe(false);
  });

  it('an interceptor that throws becomes a 500', async () => {
    @Controller('/i')
    class C {
      @Intercept(() => { throw new Error('interceptor boom'); })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/i`)).status).toBe(500);
  });

  it('async interceptor is awaited', async () => {
    @Controller('/i')
    class C {
      @Intercept(async (d: { n: number }) => {
        await new Promise((r) => setTimeout(r, 5));
        return { n: d.n + 1 };
      })
      @Get('/') h() { return { n: 1 }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/i`).then((r) => r.json())).toEqual({ n: 2 });
  });
});

describe('E2E @Catch', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('a non-Error return from the handler shapes the 200 body', async () => {
    @Controller('/c')
    class C {
      @Catch((e: Error) => ({ handled: e.message }))
      @Get('/') h(): never { throw new Error('kaboom'); }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: 'kaboom' });
  });

  it('handlers that all return an Error end as 500', async () => {
    @Controller('/c')
    class C {
      @Catch((e: Error) => e)
      @Catch((e: Error) => e)
      @Get('/') h(): never { throw new Error('unhandled'); }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/c`)).status).toBe(500);
  });

  it('an earlier handler can hand a new error to the next', async () => {
    const seen: string[] = [];
    @Controller('/c')
    class C {
      @Catch((e: Error) => { seen.push(`outer:${e.message}`); return { done: true }; })
      @Catch((e: Error) => { seen.push(`inner:${e.message}`); return new Error('rewrapped'); })
      @Get('/') h(): never { throw new Error('orig'); }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`);
    expect(await res.json()).toEqual({ done: true });
    expect(seen).toEqual(['inner:orig', 'outer:rewrapped']);
  });

  it('catches an error thrown from the pipe phase', async () => {
    @Controller('/c')
    class C {
      @Catch((e: Error) => ({ recovered: e.message }))
      @Pipe({ body: () => { throw new Error('pipe fail'); } })
      @Post('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recovered: 'pipe fail' });
  });

  it('catches an error thrown from a @Use middleware and its return shapes the body', async () => {
    @Controller('/c')
    class C {
      @Catch((e: Error) => ({ shaped: true, msg: e.message }))
      @Use(() => { throw new Error('mw boom'); })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shaped: true, msg: 'mw boom' });
  });

  it('catches an error thrown from a guard', async () => {
    @Controller('/c')
    class C {
      @Catch((e: Error) => ({ recovered: e.message }))
      @Guard(() => { throw new Error('guard fail'); })
      @Get('/') h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/c`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recovered: 'guard fail' });
  });
});

describe('E2E error codes vs @Catch (SKIP_ERROR_HANDLER_CODES)', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  const cases: [string, () => Error, number][] = [
    ['ForbiddenError', () => new ForbiddenError('x'), 403],
    ['NotFoundError', () => new NotFoundError('x'), 404],
    ['UnauthorizedError', () => new UnauthorizedError('x'), 401],
    ['RateLimitExceededError', () => new RateLimitExceededError('x'), 429],
  ];

  for (const [name, make, code] of cases) {
    it(`${name} without @Catch -> ${code}, handler-defined behavior skipped`, async () => {
      @Controller('/e')
      class C {
        @Get('/') h(): never { throw make(); }
      }
      ctx = await startE2E([C]);
      expect((await fetch(`${ctx.base}/e`)).status).toBe(code);
    });

    it(`${name} WITH @Catch -> handler runs and shapes the body`, async () => {
      @Controller('/e')
      class C {
        @Catch(() => ({ caught: name }))
        @Get('/') h(): never { throw make(); }
      }
      ctx = await startE2E([C]);
      const res = await fetch(`${ctx.base}/e`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ caught: name });
    });
  }

  it('a generic Error without @Catch -> 500', async () => {
    @Controller('/e')
    class C {
      @Get('/') h(): never { throw new Error('plain'); }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/e`)).status).toBe(500);
  });
});

describe('E2E @Status / Ok2xx', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('method-level @Status sets the success code', async () => {
    @Controller('/s')
    class C {
      @Status(201)
      @Post('/') h() { return { id: 1 }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/s`, { method: 'POST' })).status).toBe(201);
  });

  it('class-level @Status is the default for every route', async () => {
    @Status(202)
    @Controller('/s')
    class C {
      @Get('/a') a() { return {}; }
      @Get('/b') b() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/s/a`)).status).toBe(202);
    expect((await fetch(`${ctx.base}/s/b`)).status).toBe(202);
  });

  it('method-level @Status overrides class-level', async () => {
    @Status(202)
    @Controller('/s')
    class C {
      @Status(201)
      @Get('/a') a() { return {}; }
      @Get('/b') b() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/s/a`)).status).toBe(201);
    expect((await fetch(`${ctx.base}/s/b`)).status).toBe(202);
  });

  it('Ok201 shortcut', async () => {
    @Controller('/s')
    class C {
      @Ok201()
      @Post('/') h() { return { id: 1 }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/s`, { method: 'POST' })).status).toBe(201);
  });

  it('Ok204 -> status 204 and an empty body over the wire', async () => {
    @Controller('/s')
    class C {
      @Ok204()
      @Get('/') h() { return null; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/s`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('a redirect keeps its 3xx status, ignoring @Status', async () => {
    @Controller('/s')
    class C {
      @Status(200)
      @Get('/') h(@Res() res: { redirect: (u: string, c?: number) => void }) {
        res.redirect('/elsewhere', 301);
        return null;
      }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/s`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/elsewhere');
  });
});
