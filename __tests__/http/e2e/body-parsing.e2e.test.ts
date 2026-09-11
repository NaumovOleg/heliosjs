import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Body, Controller, Post } from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E body parsing (trust boundary)', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('malformed JSON body → 400, handler never runs', async () => {
    let ran = false;
    @Controller('/u')
    class C {
      @Post('/') create(@Body() b: unknown) {
        ran = true;
        return b;
      }
    }
    ctx = await startE2E([C]);

    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 400, message: 'Invalid JSON body' });
    expect(ran).toBe(false);
  });

  it('valid JSON body still parses', async () => {
    @Controller('/u')
    class C {
      @Post('/') create(@Body() b: { a: number }) {
        return { got: b.a };
      }
    }
    ctx = await startE2E([C]);

    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 7 }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: 7 });
  });

  it('oversized body -> clean 413, socket not reset', async () => {
    @Controller('/u')
    class C {
      @Post('/') create(@Body() b: unknown) {
        return b;
      }
    }
    ctx = await startE2E([C], { bodyLimit: 16 });

    const res = await fetch(`${ctx.base}/u`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ big: 'x'.repeat(1000) }),
    });

    expect(res.status).toBe(413);
    expect(res.headers.get('connection')).toBe('close');
    expect(await res.json()).toMatchObject({ status: 413 });
  });
});
