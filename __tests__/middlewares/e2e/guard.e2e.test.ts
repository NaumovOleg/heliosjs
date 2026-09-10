import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, setRolesExtractor } from '@heliosjs/core';
import { Guard, Roles } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E @Guard', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('function guard: true passes, false is 403 and the handler is skipped', async () => {
    let handlerRan = false;
    @Controller('/g')
    class C {
      @Guard((req: { headers?: Record<string, string> }) => !!req.headers?.authorization)
      @Get('/')
      h() { handlerRan = true; return { ok: true }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/g`)).status).toBe(403);
    expect(handlerRan).toBe(false);
    const ok = await fetch(`${ctx.base}/g`, { headers: { authorization: 'x' } });
    expect(ok.status).toBe(200);
  });

  it('function guard returning a string blocks with that message', async () => {
    @Controller('/g')
    class C {
      @Guard(() => 'nope, not you')
      @Get('/')
      h() { return {}; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/g`);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('nope, not you');
  });

  it('async function guard is awaited', async () => {
    @Controller('/g')
    class C {
      @Guard(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return false;
      })
      @Get('/')
      h() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/g`)).status).toBe(403);
  });

  it('class guard is instantiated per request; its `message` is used on denial', async () => {
    let constructed = 0;
    class AdminGuard {
      message = 'admins only';
      canActivate(req: { headers?: Record<string, string> }) {
        constructed++;
        return req.headers?.['x-role'] === 'admin';
      }
    }
    @Controller('/g')
    class C {
      @Guard(AdminGuard)
      @Get('/')
      h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const denied = await fetch(`${ctx.base}/g`);
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain('admins only');
    expect((await fetch(`${ctx.base}/g`, { headers: { 'x-role': 'admin' } })).status).toBe(200);
    expect(constructed).toBe(2);
  });

  it('instance guard: canActivate + message property', async () => {
    const guard = {
      message: 'instance says no',
      canActivate: (req: { headers?: Record<string, string> }) => req.headers?.pass === 'yes',
    };
    @Controller('/g')
    class C {
      @Guard(guard)
      @Get('/')
      h() { return { ok: true }; }
    }
    ctx = await startE2E([C]);
    const denied = await fetch(`${ctx.base}/g`);
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain('instance says no');
    expect((await fetch(`${ctx.base}/g`, { headers: { pass: 'yes' } })).status).toBe(200);
  });

  it('instance guard returning a string overrides its message', async () => {
    const guard = {
      message: 'default msg',
      canActivate: () => 'runtime msg',
    };
    @Controller('/g')
    class C {
      @Guard(guard)
      @Get('/')
      h() { return {}; }
    }
    ctx = await startE2E([C]);
    expect(await (await fetch(`${ctx.base}/g`)).text()).toContain('runtime msg');
  });

  it('multiple guards: all must pass, and a later guard does not run after a failure', async () => {
    const ran: string[] = [];
    @Controller('/g')
    class C {
      @Guard(() => { ran.push('first'); return false; })
      @Guard(() => { ran.push('second'); return true; })
      @Get('/')
      h() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/g`)).status).toBe(403);
    expect(ran).toEqual(['first']);
  });

  it('a controller guard blocks every route', async () => {
    @Guard(() => false)
    @Controller('/g')
    class C {
      @Get('/a') a() { return {}; }
      @Get('/b') b() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/g/a`)).status).toBe(403);
    expect((await fetch(`${ctx.base}/g/b`)).status).toBe(403);
  });

  it('a guard throwing a non-Forbidden error surfaces as 500', async () => {
    @Controller('/g')
    class C {
      @Guard(() => { throw new Error('guard blew up'); })
      @Get('/')
      h() { return {}; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/g`)).status).toBe(500);
  });
});

describe('E2E @Roles (RBAC)', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
    setRolesExtractor(undefined);
  });

  const withRoles = (roles: string[] | string | null) =>
    startE2E([RolesCtrlAny], { rbac: { getRoles: () => roles } });

  @Controller('/r')
  class RolesCtrlAny {
    @Roles('admin')
    @Get('/one') one() { return { ok: true }; }

    @Roles('admin', 'editor')
    @Get('/any') any() { return { ok: true }; }

    @Roles(['admin', 'editor'], { mode: 'all' })
    @Get('/all') all() { return { ok: true }; }

    @Roles('admin', { message: 'no entry' })
    @Get('/msg') msg() { return { ok: true }; }
  }

  it('passes when the extractor yields a required role', async () => {
    ctx = await withRoles(['admin']);
    expect((await fetch(`${ctx.base}/r/one`)).status).toBe(200);
  });

  it('403 when the extractor yields no required role', async () => {
    ctx = await withRoles(['guest']);
    const res = await fetch(`${ctx.base}/r/one`);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('Insufficient role');
  });

  it('ANY mode: one of the listed roles is enough', async () => {
    ctx = await withRoles(['editor']);
    expect((await fetch(`${ctx.base}/r/any`)).status).toBe(200);
  });

  it('ALL mode: every listed role is required', async () => {
    ctx = await withRoles(['admin']);
    expect((await fetch(`${ctx.base}/r/all`)).status).toBe(403);
    await ctx.close();
    ctx = await withRoles(['admin', 'editor']);
    expect((await fetch(`${ctx.base}/r/all`)).status).toBe(200);
  });

  it('custom message', async () => {
    ctx = await withRoles([]);
    expect(await (await fetch(`${ctx.base}/r/msg`)).text()).toContain('no entry');
  });

  it('a scalar role from the extractor is treated as a single-role list', async () => {
    ctx = await withRoles('admin');
    expect((await fetch(`${ctx.base}/r/one`)).status).toBe(200);
  });

  it('no extractor configured -> InvalidStateError (409), not a silent 403', async () => {
    @Controller('/r')
    class C {
      @Roles('admin')
      @Get('/') h() { return {}; }
    }
    ctx = await startE2E([C]); // no rbac config
    expect((await fetch(`${ctx.base}/r`)).status).toBe(409);
  });
});
