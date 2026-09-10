import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, Params } from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

/**
 * Route matching through real HTTP. Pins the specificity ladder from
 * match.ts (`routeSpecificity`): static > :param(regex) > :param > optional > *,
 * left-to-right, ties keep the first-declared route. Also checks that the param
 * value the handler receives is correct for every pattern kind — this is
 * `buildParamExtractor`, which does NOT share code with the matcher.
 */
describe('E2E routing: specificity ladder', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  const hitTag = async (path: string): Promise<string> => {
    const res = await fetch(`${ctx.base}${path}`);
    expect(res.status, `${path} -> ${res.status}`).toBe(200);
    return (await res.json()).tag;
  };

  it('static segment beats a wildcard', async () => {
    @Controller('/')
    class C {
      @Get('/users') a() { return { tag: 'static' }; }
      @Get('/*') b() { return { tag: 'wild' }; }
    }
    ctx = await startE2E([C]);
    expect(await hitTag('/users')).toBe('static');
    expect(await hitTag('/anything')).toBe('wild');
  });

  it('a named param beats a wildcard at the same depth', async () => {
    @Controller('/users')
    class C {
      @Get('/:id') a(@Params('id') id: string) { return { tag: 'param', id }; }
      @Get('/*') b() { return { tag: 'wild' }; }
    }
    ctx = await startE2E([C]);
    expect(await hitTag('/users/5')).toBe('param');
    expect(await hitTag('/users/a/b')).toBe('wild');
  });

  it('a static segment beats a named param', async () => {
    @Controller('/users')
    class C {
      @Get('/:id') a() { return { tag: 'param' }; }
      @Get('/me') b() { return { tag: 'me' }; }
    }
    ctx = await startE2E([C]);
    expect(await hitTag('/users/me')).toBe('me');
    expect(await hitTag('/users/999')).toBe('param');
  });

  it('a regex-constrained param beats a plain param, and only matches its pattern', async () => {
    @Controller('/users')
    class C {
      @Get('/:id(\\d+)') num(@Params('id') id: string) { return { tag: 'num', id }; }
      @Get('/:slug') slug(@Params('slug') slug: string) { return { tag: 'slug', slug }; }
    }
    ctx = await startE2E([C]);
    const num = await fetch(`${ctx.base}/users/42`).then((r) => r.json());
    expect(num.tag).toBe('num');
    const slug = await fetch(`${ctx.base}/users/bob`).then((r) => r.json());
    expect(slug.tag).toBe('slug');
    expect(slug.slug).toBe('bob');
  });

  it('a shorter exact path beats a longer optional/wildcard sibling', async () => {
    @Controller('/a')
    class C {
      @Get('/') exact() { return { tag: 'exact' }; }
      @Get('/:x?') opt() { return { tag: 'opt' }; }
      @Get('/*') wild() { return { tag: 'wild' }; }
    }
    ctx = await startE2E([C]);
    expect(await hitTag('/a')).toBe('exact');
  });

  it('ties keep the first-declared route', async () => {
    @Controller('/p')
    class C {
      @Get('/:a') first(@Params('a') a: string) { return { tag: 'first', a }; }
      @Get('/:b') second(@Params('b') b: string) { return { tag: 'second', b }; }
    }
    ctx = await startE2E([C]);
    const data = await fetch(`${ctx.base}/p/1`).then((r) => r.json());
    expect(data.tag).toBe('first');
    expect(data.a).toBe('1');
  });

  it('a matching route in a child controller beats the parent wildcard', async () => {
    @Controller('/things')
    class Child {
      @Get('/special') s() { return { tag: 'child-static' }; }
    }
    @Controller({ prefix: '/', controllers: [Child] })
    class Root {
      @Get('/*') catchall() { return { tag: 'root-wild' }; }
    }
    ctx = await startE2E([Root]);
    expect(await hitTag('/things/special')).toBe('child-static');
    expect(await hitTag('/things/other')).toBe('root-wild');
  });

  it('trailing slash on the request still matches', async () => {
    @Controller('/x')
    class C {
      @Get('/y') y() { return { tag: 'y' }; }
    }
    ctx = await startE2E([C]);
    expect(await hitTag('/x/y/')).toBe('y');
  });

  it('no route matches -> 404', async () => {
    @Controller('/x')
    class C {
      @Get('/y') y() { return { tag: 'y' }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/x/z`)).status).toBe(404);
  });
});

describe('E2E routing: param extraction per pattern kind', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('plain :param', async () => {
    @Controller('/a')
    class C {
      @Get('/:id') h(@Params('id') id: string) { return { id }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/a/7`).then((r) => r.json())).toEqual({ id: '7' });
  });

  it('multiple params in one route', async () => {
    @Controller('/api')
    class C {
      @Get('/:v/users/:id') h(@Params('v') v: string, @Params('id') id: string) {
        return { v, id };
      }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/api/v2/users/9`).then((r) => r.json())).toEqual({
      v: 'v2',
      id: '9',
    });
  });

  it('trailing wildcard is exposed as @Params("*")', async () => {
    @Controller('/assets')
    class C {
      @Get('/*') h(@Params('*') rest: string) { return { rest }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/assets/css/app.css`).then((r) => r.json())).toEqual({
      rest: 'css/app.css',
    });
  });

  it('mid-route wildcard matches but does not populate @Params (trailing * is the supported form)', async () => {
    @Controller('/m')
    class C {
      @Get('/*/end') h(@Params('*') w: string | undefined) { return { w: w ?? null }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/m/anything/end`)).status).toBe(200);
    expect((await fetch(`${ctx.base}/m/a/b/end`)).status).toBe(200);
    expect((await fetch(`${ctx.base}/m/a/other`)).status).toBe(404);
    // NOTE: the captured segment(s) are NOT available — compileRouteRegex emits a
    // non-capturing `.*` for a non-trailing `*`. Use a trailing `*` if you need
    // the value.
    expect(await fetch(`${ctx.base}/m/x/end`).then((r) => r.json())).toEqual({ w: null });
  });

  // Fixed: param extraction now shares match.ts's regex/segment logic, so
  // `:id(\d+)` resolves by name.
  it('regex-constrained :param(\\d+) is readable by its name', async () => {
    @Controller('/u')
    class C {
      @Get('/:id(\\d+)') h(@Params('id') id: string) { return { id }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/u/42`).then((r) => r.json())).toEqual({ id: '42' });
  });

  // Optional segment. buildParamExtractor treats `:file?` as a literal param name
  // and requires an exact segment count -> the value is lost at handler time even
  // though the route matches. Present-segment case is the interesting one.
  it('optional :param? — route serves with and without the segment', async () => {
    @Controller('/d')
    class C {
      @Get('/:file?') h(@Params('file') file: string | undefined, @Params() all: Record<string, string>) {
        return { file: file ?? null, keys: Object.keys(all) };
      }
    }
    ctx = await startE2E([C]);
    const withArg = await fetch(`${ctx.base}/d/report.pdf`);
    const without = await fetch(`${ctx.base}/d`);
    expect(withArg.status).toBe(200);
    expect(without.status).toBe(200);
    // SPEC: @Params('file') should be 'report.pdf'. Documents whatever it is.
    expect(await withArg.json()).toEqual({ file: 'report.pdf', keys: ['file'] });
  });
});
