import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Body, Controller, Files, Post } from '@heliosjs/core';
import { startE2E, type E2EApp } from '../../helpers/e2e';

describe('E2E multipart / @Files', () => {
  let ctx: E2EApp;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined as never;
  });

  it('@Files() exposes uploaded files; @Body() exposes the text fields', async () => {
    @Controller('/up')
    class C {
      @Post('/')
      h(@Files() files: Record<string, { filename: string; data: Buffer }>, @Body() fields: Record<string, unknown>) {
        const f = files.doc as { filename: string; data: Buffer };
        return { name: f.filename, text: Buffer.from(f.data).toString(), fields };
      }
    }
    ctx = await startE2E([C]);
    const form = new FormData();
    form.append('title', 'hello');
    form.append('doc', new Blob(['file body'], { type: 'text/plain' }), 'a.txt');

    const res = await fetch(`${ctx.base}/up`, { method: 'POST', body: form });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('a.txt');
    expect(data.text).toBe('file body');
    expect(data.fields).toMatchObject({ title: 'hello' });
  });

  it('@Files(name) selects one field', async () => {
    @Controller('/up')
    class C {
      @Post('/')
      h(@Files('avatar') avatar: { filename: string; size: number }) {
        return { filename: avatar.filename, size: avatar.size };
      }
    }
    ctx = await startE2E([C]);
    const form = new FormData();
    form.append('avatar', new Blob(['1234567890'], { type: 'image/png' }), 'me.png');

    const res = await fetch(`${ctx.base}/up`, { method: 'POST', body: form });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ filename: 'me.png', size: 10 });
  });

  it('multiple files under the same field come back as an array', async () => {
    @Controller('/up')
    class C {
      @Post('/')
      h(@Files('page') pages: { filename: string }[] | { filename: string }) {
        return { count: Array.isArray(pages) ? pages.length : 1, isArray: Array.isArray(pages) };
      }
    }
    ctx = await startE2E([C]);
    const form = new FormData();
    form.append('page', new Blob(['one']), 'p1.txt');
    form.append('page', new Blob(['two']), 'p2.txt');

    const res = await fetch(`${ctx.base}/up`, { method: 'POST', body: form });
    expect(await res.json()).toEqual({ count: 2, isArray: true });
  });

  it('a form with only text fields yields empty files and populated body', async () => {
    @Controller('/up')
    class C {
      @Post('/')
      h(@Files() files: Record<string, unknown>, @Body() body: Record<string, unknown>) {
        return { fileKeys: Object.keys(files), body };
      }
    }
    ctx = await startE2E([C]);
    const form = new FormData();
    form.append('num', '1'); // scalar -> stays string
    form.append('word', 'hello'); // scalar -> stays string
    form.append('json', '{"k":1}'); // object -> decoded

    const res = await fetch(`${ctx.base}/up`, { method: 'POST', body: form });
    const data = await res.json();
    expect(data.fileKeys).toEqual([]);
    // Only JSON objects/arrays are decoded; scalars stay strings.
    expect(data.body).toMatchObject({ num: '1', word: 'hello', json: { k: 1 } });
  });
});
