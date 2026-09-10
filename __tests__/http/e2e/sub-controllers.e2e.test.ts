import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, Params } from '@heliosjs/core';
import { Use, Guard } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E sub-controllers', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('routes are reachable at the fully-joined prefix, 3 levels deep', async () => {
    @Controller('/users')
    class Users {
      @Get('/:id') one(@Params('id') id: string) { return { id, level: 3 }; }
    }
    @Controller({ prefix: '/v1', controllers: [Users] })
    class V1 {
      @Get('/ping') ping() { return { level: 2 }; }
    }
    @Controller({ prefix: '/api', controllers: [V1] })
    class Api {
      @Get('/') root() { return { level: 1 }; }
    }
    ctx = await startE2E([Api]);
    expect(await fetch(`${ctx.base}/api`).then((r) => r.json())).toEqual({ level: 1 });
    expect(await fetch(`${ctx.base}/api/v1/ping`).then((r) => r.json())).toEqual({ level: 2 });
    expect(await fetch(`${ctx.base}/api/v1/users/42`).then((r) => r.json())).toEqual({
      id: '42',
      level: 3,
    });
  });

  it('middleware is inherited grandparent -> parent -> child, in that order', async () => {
    const log: string[] = [];
    @Use((_r: never, _s: never, n: () => void) => { log.push('child'); n(); })
    @Controller('/leaf')
    class Leaf {
      @Get('/') h() { log.push('handler'); return {}; }
    }
    @Use((_r: never, _s: never, n: () => void) => { log.push('parent'); n(); })
    @Controller({ prefix: '/mid', controllers: [Leaf] })
    class Mid {}
    @Use((_r: never, _s: never, n: () => void) => { log.push('grandparent'); n(); })
    @Controller({ prefix: '/top', controllers: [Mid] })
    class Top {}

    ctx = await startE2E([Top]);
    await fetch(`${ctx.base}/top/mid/leaf`);
    expect(log).toEqual(['grandparent', 'parent', 'child', 'handler']);
  });

  it('a guard on an ancestor blocks a descendant route', async () => {
    @Controller('/secret')
    class Secret {
      @Get('/') h() { return { ok: true }; }
    }
    @Guard(() => false)
    @Controller({ prefix: '/area', controllers: [Secret] })
    class Area {}
    ctx = await startE2E([Area]);
    expect((await fetch(`${ctx.base}/area/secret`)).status).toBe(403);
  });

  it('sibling children are isolated', async () => {
    const hits: string[] = [];
    @Use((_r: never, _s: never, n: () => void) => { hits.push('A-mw'); n(); })
    @Controller('/a')
    class A {
      @Get('/') h() { return { who: 'a' }; }
    }
    @Controller('/b')
    class B {
      @Get('/') h() { return { who: 'b' }; }
    }
    @Controller({ prefix: '/root', controllers: [A, B] })
    class Root {}
    ctx = await startE2E([Root]);
    await fetch(`${ctx.base}/root/b`);
    expect(hits).toEqual([]); // A's middleware never fired for B
    expect(await fetch(`${ctx.base}/root/a`).then((r) => r.json())).toEqual({ who: 'a' });
  });

  it('prefix join collapses slashes', async () => {
    @Controller('/child/')
    class Child {
      @Get('/') h() { return { ok: true }; }
    }
    @Controller({ prefix: '/parent/', controllers: [Child] })
    class Parent {}
    ctx = await startE2E([Parent]);
    expect((await fetch(`${ctx.base}/parent/child`)).status).toBe(200);
  });

  it('an empty "/" parent prefix does not prepend anything', async () => {
    @Controller('/thing')
    class Thing {
      @Get('/') h() { return { ok: true }; }
    }
    @Controller({ prefix: '/', controllers: [Thing] })
    class Root {}
    ctx = await startE2E([Root]);
    expect((await fetch(`${ctx.base}/thing`)).status).toBe(200);
  });

  // `static controllers = [...]` is NOT how sub-controllers are mounted — only
  // the config-object `controllers` field is read (descriptors/meta.ts). Parent
  // routes still work, child routes 404. Documents the gap the existing
  // http-deep-pipeline test doesn't catch (it only checks the parent route).
  it('`static controllers` does not mount child routes', async () => {
    @Controller('/dash')
    class Dash {
      @Get('/') h() { return { ok: true }; }
    }
    @Controller('/adm')
    class Adm {
      static controllers = [Dash];
      @Get('/status') status() { return { ok: true }; }
    }
    ctx = await startE2E([Adm]);
    expect((await fetch(`${ctx.base}/adm/status`)).status).toBe(200);
    expect((await fetch(`${ctx.base}/adm/dash`)).status).toBe(404);
  });
});
