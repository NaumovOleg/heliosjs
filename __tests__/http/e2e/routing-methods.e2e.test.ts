import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Any,
  Body,
  Controller,
  Delete,
  Endpoint,
  Get,
  Head,
  HTTP_METHODS,
  Options,
  Patch,
  Post,
  Put,
  Query,
} from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

/**
 * HTTP method dispatch. Asserts the documented contract: a verb shortcut maps a
 * method to exactly its handler, `@Any` matches every verb, and a method with no
 * matching route is a 404.
 */
describe('E2E routing: HTTP method dispatch', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('routes each verb to its own handler', async () => {
    @Controller('/r')
    class R {
      @Get('/x') g() { return { verb: 'GET' }; }
      @Post('/x') p() { return { verb: 'POST' }; }
      @Put('/x') pu() { return { verb: 'PUT' }; }
      @Patch('/x') pa() { return { verb: 'PATCH' }; }
      @Delete('/x') d() { return { verb: 'DELETE' }; }
    }
    ctx = await startE2E([R]);

    for (const verb of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(`${ctx.base}/r/x`, { method: verb });
      expect(res.status, verb).toBe(200);
      expect(await res.json(), verb).toEqual({ verb });
    }
  });

  it('OPTIONS reaches its handler when declared (no server CORS)', async () => {
    @Controller('/o')
    class O {
      @Options('/x') h() { return { ok: true }; }
    }
    ctx = await startE2E([O]);
    const res = await fetch(`${ctx.base}/o/x`, { method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('HEAD reaches an explicit @Head handler with no body', async () => {
    @Controller('/h')
    class H {
      @Head('/x') h() { return { alive: true }; }
    }
    ctx = await startE2E([H]);
    const res = await fetch(`${ctx.base}/h/x`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('@Any matches every verb on its path', async () => {
    @Controller('/a')
    class A {
      @Any() h() { return { any: true }; }
    }
    ctx = await startE2E([A]);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(`${ctx.base}/a/anything/deep`, { method });
      expect(res.status, method).toBe(200);
      expect(await res.json(), method).toEqual({ any: true });
    }
  });

  it('@Endpoint(ANY, path) matches every verb on that exact path', async () => {
    @Controller('/e')
    class E {
      @Endpoint(HTTP_METHODS.ANY, '/x') h() { return { any: true }; }
    }
    ctx = await startE2E([E]);
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(`${ctx.base}/e/x`, { method });
      expect(res.status, method).toBe(200);
    }
  });

  it('lowercase method string is upper-cased by @Endpoint', async () => {
    @Controller('/lc')
    class LC {
      @Endpoint('get' as unknown as HTTP_METHODS, '/x') h() { return { ok: true }; }
    }
    ctx = await startE2E([LC]);
    const res = await fetch(`${ctx.base}/lc/x`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('a request method with no matching route is 404', async () => {
    @Controller('/m')
    class M {
      @Get('/x') g() { return { ok: true }; }
    }
    ctx = await startE2E([M]);
    const res = await fetch(`${ctx.base}/m/x`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  // Fixed (was B3): HEAD now falls back to the matching GET handler, no body.
  it('HEAD falls back to a GET handler (Express/Fastify parity)', async () => {
    @Controller('/hf')
    class HF {
      @Get('/x') g() { return { ok: true }; }
    }
    ctx = await startE2E([HF]);
    const res = await fetch(`${ctx.base}/hf/x`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('@Query reads its payload from the request body (Endpoint.ts contract)', async () => {
    @Controller('/s')
    class S {
      @Query('/search') search(@Body() filter: Record<string, unknown>) {
        return { filter };
      }
    }
    ctx = await startE2E([S]);
    const res = await fetch(`${ctx.base}/s/search?q=fromurl`, {
      method: 'QUERY',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: 'frombody', page: 2 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).filter).toEqual({ q: 'frombody', page: 2 });
  });

  it('two verbs on the same path each hit their own handler', async () => {
    const seen: string[] = [];
    @Controller('/t')
    class T {
      @Get('/x') g() { seen.push('get'); return { m: 'get' }; }
      @Post('/x') p() { seen.push('post'); return { m: 'post' }; }
    }
    ctx = await startE2E([T]);
    await fetch(`${ctx.base}/t/x`);
    await fetch(`${ctx.base}/t/x`, { method: 'POST' });
    expect(seen).toEqual(['get', 'post']);
  });
});
