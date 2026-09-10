import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Body, Controller, Cookies, Get, Headers, Params, Post, QueryParam } from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  age!: number;
}

class PageDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page!: number;
}

describe('E2E param validation (class-validator DTOs)', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('@Body(Dto): valid payload is transformed and passed through', async () => {
    @Controller('/u')
    class C {
      @Post('/') create(@Body(CreateUserDto) dto: CreateUserDto) {
        return { name: dto.name, age: dto.age, isInstance: dto instanceof CreateUserDto };
      }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ann', age: '30' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Ann', age: 30, isInstance: true });
  });

  it('@Body(Dto): invalid payload is rejected with 400', async () => {
    @Controller('/u')
    class C {
      @Post('/') create(@Body(CreateUserDto) dto: CreateUserDto) { return dto; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', age: -3 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/name|age|validation/i);
  });

  it('@QueryParam(Dto): query values are validated and coerced', async () => {
    @Controller('/q')
    class C {
      @Get('/') list(@QueryParam(PageDto) q: PageDto) { return { page: q.page, t: typeof q.page }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/q?page=3`).then((r) => r.json())).toEqual({ page: 3, t: 'number' });
    expect((await fetch(`${ctx.base}/q?page=0`)).status).toBe(400);
  });

  it('@Params(Dto): route params are validated', async () => {
    class IdDto {
      @IsInt()
      @Min(1)
      @Type(() => Number)
      id!: number;
    }
    @Controller('/p')
    class C {
      @Get('/:id') one(@Params(IdDto) p: IdDto) { return { id: p.id, t: typeof p.id }; }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/p/5`).then((r) => r.json())).toEqual({ id: 5, t: 'number' });
    expect((await fetch(`${ctx.base}/p/abc`)).status).toBe(400);
  });

  // Fixed (was B14): @Headers/@Cookies/@Files now accept a DTO class (first arg),
  // routed to `param.dto` and validated like @Body/@Params.
  it('@Headers(Dto): headers are validated', async () => {
    class AuthDto {
      @IsString()
      @MinLength(8)
      authorization!: string;
    }
    @Controller('/h')
    class C {
      @Get('/') h(@Headers(AuthDto as never) hdr: AuthDto) { return { ok: !!hdr.authorization }; }
    }
    ctx = await startE2E([C]);
    expect(
      (await fetch(`${ctx.base}/h`, { headers: { authorization: 'short' } })).status
    ).toBe(400);
  });

  it('@Cookies(Dto): cookies are validated', async () => {
    class SessionDto {
      @IsString()
      @MinLength(3)
      sid!: string;
    }
    @Controller('/c')
    class C {
      @Get('/') h(@Cookies(SessionDto as never) c: SessionDto) { return { sid: c.sid }; }
    }
    ctx = await startE2E([C]);
    expect((await fetch(`${ctx.base}/c`, { headers: { cookie: 'sid=ab' } })).status).toBe(400);
  });

  it('@Body(Dto, name): pulls a single validated field', async () => {
    @Controller('/u')
    class C {
      @Post('/') create(@Body(CreateUserDto, 'name') name: string) { return { name }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', age: 20 }),
    });
    expect(await res.json()).toEqual({ name: 'Bob' });
  });

  it('a DTO exposing a static from() is used verbatim (no class-validator run)', async () => {
    const FilterDto = {
      from: (raw: Record<string, unknown>) => ({ q: String(raw.q ?? ''), normalized: true }),
    };
    @Controller('/s')
    class C {
      @Get('/') search(@QueryParam(FilterDto as never) f: { q: string; normalized: boolean }) {
        return f;
      }
    }
    ctx = await startE2E([C]);
    expect(await fetch(`${ctx.base}/s?q=hi`).then((r) => r.json())).toEqual({
      q: 'hi',
      normalized: true,
    });
  });

  it('@Body() without a DTO does not validate', async () => {
    @Controller('/raw')
    class C {
      @Post('/') h(@Body() body: unknown) { return { body }; }
    }
    ctx = await startE2E([C]);
    const res = await fetch(`${ctx.base}/raw`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anything: [1, 2, 3] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ body: { anything: [1, 2, 3] } });
  });
});
