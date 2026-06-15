import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedWindow, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 2,
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('fixedWindow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to max then blocks', async () => {
    const s = fixedWindow(new MemoryStore());
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    const third = await s.consume('k', ctx());
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('reports remaining and resetAt', async () => {
    const s = fixedWindow(new MemoryStore());
    const r = await s.consume('k', ctx({ max: 5 }));
    expect(r.remaining).toBe(4);
    expect(r.resetAt).toBe(Date.now() + 1000);
  });

  it('resets after the window elapses', async () => {
    const s = fixedWindow(new MemoryStore());
    await s.consume('k', ctx());
    await s.consume('k', ctx());
    expect((await s.consume('k', ctx())).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
  });

  it('defaults to an internal MemoryStore when none is given', async () => {
    const s = fixedWindow();
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(true);
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(false);
  });
});
