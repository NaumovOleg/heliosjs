import 'reflect-metadata';
import * as Joi from 'joi';
import { afterEach, describe, expect, it } from 'vitest';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Body, Controller, Get, Headers, Params, Post, QueryParam } from '@heliosjs/core';
import { Pipe, Sanitize } from '@heliosjs/middlewares';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E @Pipe', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('transforms body before the handler sees it', async () => {
    @Controller('/p')
    class C {
      @Pipe({ body: (b: { name: string }) => ({ ...b, name: b.name.trim().toUpperCase() }) })
      @Post('/') h(@Body() b: { name: string }) { return { name: b.name }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/p`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  alice  ' }),
    });
    expect(await res.json()).toEqual({ name: 'ALICE' });
  });

  it('transforms query and params', async () => {
    @Controller('/p')
    class C {
      @Pipe({
        query: (q: Record<string, string>) => ({ ...q, n: Number(q.n) * 2 }),
        params: (p: Record<string, string>) => ({ ...p, id: `#${p.id}` }),
      })
      @Get('/:id') h(@QueryParam('n') n: number, @Params('id') id: string) {
        return { n, id };
      }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/p/7?n=3`).then((r) => r.json())).toEqual({ n: 6, id: '#7' });
  });

  it('transforms headers', async () => {
    @Controller('/p')
    class C {
      @Pipe({ headers: (h: Record<string, string>) => ({ ...h, 'x-added': 'by-pipe' }) })
      @Get('/') h(@Headers('x-added') added: string) { return { added }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/p`).then((r) => r.json())).toEqual({ added: 'by-pipe' });
  });

  it('pipe output is what DTO validation runs against', async () => {
    class NDto {
      @IsInt()
      @Min(10)
      @Type(() => Number)
      n!: number;
    }
    @Controller('/p')
    class C {
      @Pipe({ body: (b: { n: number }) => ({ n: b.n + 100 }) })
      @Post('/') h(@Body(NDto) dto: NDto) { return { n: dto.n }; }
    }
    ctx = await startE2E([C]);
    // raw n=1 would fail @Min(10); piped to 101 it passes
    const res = await fetch(`${ctx.base}/p`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ n: 1 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 101 });
  });

  it('controller pipe and method pipe both apply (controller first)', async () => {
    @Pipe({ body: (b: { xs: string[] }) => ({ xs: [...b.xs, 'ctrl'] }) })
    @Controller('/p')
    class C {
      @Pipe({ body: (b: { xs: string[] }) => ({ xs: [...b.xs, 'method'] }) })
      @Post('/') h(@Body() b: { xs: string[] }) { return b; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/p`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xs: ['start'] }),
    });
    expect(await res.json()).toEqual({ xs: ['start', 'ctrl', 'method'] });
  });
});

describe('E2E @Sanitize', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('trims a body field via a joi schema', async () => {
    @Controller('/s')
    class C {
      @Sanitize({ type: 'body', schema: Joi.object({ name: Joi.string().trim() }) })
      @Post('/') h(@Body() b: { name: string }) { return { name: b.name }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/s`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  bob  ' }),
    });
    expect(await res.json()).toEqual({ name: 'bob' });
  });

  it('strips unknown keys by default (stripUnknown)', async () => {
    @Controller('/s')
    class C {
      @Sanitize({ type: 'body', schema: Joi.object({ keep: Joi.string() }) })
      @Post('/') h(@Body() b: Record<string, unknown>) { return b; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/s`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keep: 'yes', drop: 'no' }),
    });
    expect(await res.json()).toEqual({ keep: 'yes' });
  });

  it('an array of configs sanitizes multiple request parts', async () => {
    @Controller('/s')
    class C {
      @Sanitize([
        { type: 'body', schema: Joi.object({ name: Joi.string().trim() }) },
        { type: 'query', schema: Joi.object({ q: Joi.string().lowercase() }) },
      ])
      @Post('/') h(@Body() b: { name: string }, @QueryParam('q') q: string) {
        return { name: b.name, q };
      }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/s?q=HELLO`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  x  ' }),
    });
    expect(await res.json()).toEqual({ name: 'x', q: 'hello' });
  });

  it('controller-level @Sanitize applies to every route', async () => {
    @Sanitize({ type: 'query', schema: Joi.object({ q: Joi.string().trim() }) })
    @Controller('/s')
    class C {
      @Get('/a') a(@QueryParam('q') q: string) { return { q }; }
      @Get('/b') b(@QueryParam('q') q: string) { return { q }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/s/a?q=%20p%20`).then((r) => r.json())).toEqual({ q: 'p' });
    expect(await fetch(`${ctx.base}/s/b?q=%20p%20`).then((r) => r.json())).toEqual({ q: 'p' });
  });
});
