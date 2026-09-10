import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Body,
  Controller,
  Cookies,
  Fingerprint,
  Get,
  Headers,
  Params,
  Post,
  QueryParam,
  Req,
  Res,
} from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E param decorators: extraction', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('@Params() returns all params; @Params(name) returns one', async () => {
    @Controller('/p')
    class C {
      @Get('/:a/:b/all') all(@Params() p: Record<string, string>) { return p; }
      @Get('/:a/:b/one') one(@Params('b') b: string) { return { b }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/p/1/2/all`).then((r) => r.json())).toEqual({ a: '1', b: '2' });
    expect(await fetch(`${ctx.base}/p/1/2/one`).then((r) => r.json())).toEqual({ b: '2' });
  });

  it('@QueryParam() returns all; @QueryParam(name) returns one; repeated keys', async () => {
    @Controller('/q')
    class C {
      @Get('/all') all(@QueryParam() q: Record<string, unknown>) { return q; }
      @Get('/one') one(@QueryParam('x') x: string) { return { x }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/q/all?x=1&y=2`).then((r) => r.json())).toMatchObject({
      x: '1',
      y: '2',
    });
    expect(await fetch(`${ctx.base}/q/one?x=hello`).then((r) => r.json())).toEqual({ x: 'hello' });
    // repeated key — document whatever the parser yields (array or last value)
    const rep = await fetch(`${ctx.base}/q/one?x=a&x=b`).then((r) => r.json());
    expect(rep.x === 'b' || rep.x === 'a' || Array.isArray(rep.x)).toBe(true);
  });

  it('@Headers() returns all; @Headers(name) is lower-case exact', async () => {
    @Controller('/h')
    class C {
      @Get('/all') all(@Headers() h: Record<string, string>) { return { hasHost: !!h.host }; }
      @Get('/one') one(@Headers('x-token') t: string) { return { t }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/h/all`).then((r) => r.json())).toEqual({ hasHost: true });
    expect(
      await fetch(`${ctx.base}/h/one`, { headers: { 'x-token': 'abc' } }).then((r) => r.json())
    ).toEqual({ t: 'abc' });
  });

  // SPEC: header names are case-insensitive, so @Headers('X-Token') must resolve
  // the same value as the wire header 'x-token'. Helios looks the name up
  // verbatim in the lower-cased header map -> undefined. Bug B13.
  it.fails('@Headers(name) is case-insensitive', async () => {
    @Controller('/h')
    class C {
      @Get('/') h(@Headers('X-Token') t: string | undefined) { return { t: t ?? null }; }
    }
    ctx = await startE2E([C]);
    const got = await fetch(`${ctx.base}/h`, { headers: { 'x-token': 'abc' } }).then((r) => r.json());
    expect(got.t).toBe('abc');
  });

  it('@Cookies() returns all; @Cookies(name) returns one', async () => {
    @Controller('/c')
    class C {
      @Get('/all') all(@Cookies() c: Record<string, string>) { return c; }
      @Get('/one') one(@Cookies('sid') sid: string) { return { sid }; }
    }
    ctx = await startE2E([C]);
    const hdr = { cookie: 'sid=xyz; theme=dark' };
    expect(await fetch(`${ctx.base}/c/all`, { headers: hdr }).then((r) => r.json())).toMatchObject({
      sid: 'xyz',
      theme: 'dark',
    });
    expect(await fetch(`${ctx.base}/c/one`, { headers: hdr }).then((r) => r.json())).toEqual({
      sid: 'xyz',
    });
  });

  it('@Req and @Res inject the raw request/response objects', async () => {
    @Controller('/r')
    class C {
      @Get('/') h(@Req() req: { method: string }, @Res() res: { setHeader: (k: string, v: string) => void }) {
        res.setHeader('x-from-res', 'yes');
        return { method: req.method };
      }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/r`);
    expect(res.headers.get('x-from-res')).toBe('yes');
    expect(await res.json()).toEqual({ method: 'GET' });
  });

  it('@Fingerprint yields a stable string and varies with the client', async () => {
    @Controller('/f')
    class C {
      @Get('/') h(@Fingerprint() fp: string) { return { fp }; }
    }
    ctx = await startE2E([C]);
    const a1 = (await fetch(`${ctx.base}/f`, { headers: { 'user-agent': 'A' } }).then((r) => r.json())).fp;
    const a2 = (await fetch(`${ctx.base}/f`, { headers: { 'user-agent': 'A' } }).then((r) => r.json())).fp;
    const b = (await fetch(`${ctx.base}/f`, { headers: { 'user-agent': 'B' } }).then((r) => r.json())).fp;
    expect(typeof a1).toBe('string');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('an undecorated parameter slot resolves to undefined', async () => {
    @Controller('/gap')
    class C {
      @Get('/:id') h(@Params('id') id: string, skipped: unknown, @Req() req: { method: string }) {
        return { id, skipped: skipped ?? null, method: req.method };
      }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/gap/7`).then((r) => r.json())).toEqual({
      id: '7',
      skipped: null,
      method: 'GET',
    });
  });

  it('a handler with no param decorators receives (request, response)', async () => {
    @Controller('/none')
    class C {
      @Get('/') h(req: { method?: string }, res: { setHeader?: unknown }) {
        return { isReq: typeof req?.method === 'string', isRes: typeof res?.setHeader === 'function' };
      }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/none`).then((r) => r.json())).toEqual({ isReq: true, isRes: true });
  });

  it('mixed decorators resolve independently on one handler', async () => {
    @Controller('/mix')
    class C {
      @Post('/:id')
      h(
        @Params('id') id: string,
        @Body() body: { note: string },
        @Headers('x-trace') trace: string,
        @QueryParam('mode') mode: string
      ) {
        return { id, note: body.note, trace, mode };
      }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/mix/42?mode=fast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trace': 't-1' },
      body: JSON.stringify({ note: 'hi' }),
    });
    expect(await res.json()).toEqual({ id: '42', note: 'hi', trace: 't-1', mode: 'fast' });
  });
});
