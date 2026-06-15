import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slidingWindow, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 2,
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('slidingWindow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to max within one window', async () => {
    // Align to a window boundary so weighting from the previous window is zero.
    vi.setSystemTime(2000);
    const s = slidingWindow(new MemoryStore());
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(false);
  });

  it('blocks a boundary burst that a fixed window would allow', async () => {
    vi.setSystemTime(2000); // start of window [2000, 3000)
    const s = slidingWindow(new MemoryStore());
    await s.consume('k', ctx({ max: 2 })); // current window count -> 1
    await s.consume('k', ctx({ max: 2 })); // current window count -> 2 (full)

    vi.setSystemTime(3001); // 1ms into the next window [3000, 4000)
    // prevWeight ~= (1000 - 1) / 1000 = 0.999
    // estimated ~= prev(2) * 0.999 + curr(1) ~= 2.998 > 2 -> blocked
    const r = await s.consume('k', ctx({ max: 2 }));
    expect(r.allowed).toBe(false);
  });

  it('reports a resetAt at the end of the current window', async () => {
    vi.setSystemTime(2000);
    const s = slidingWindow(new MemoryStore());
    const r = await s.consume('k', ctx());
    expect(r.resetAt).toBe(3000); // currStart(2000) + windowMs(1000)
  });

  it('deletes the stale (two-windows-back) sub-key to bound memory', async () => {
    const inner = new MemoryStore();
    const resetCalls: string[] = [];
    const spyStore = {
      get: (k: string) => inner.get(k),
      set: (k: string, s: any, ttl: number) => inner.set(k, s, ttl),
      reset: (k: string) => {
        resetCalls.push(k);
        return inner.reset(k);
      },
    };

    vi.setSystemTime(2000); // window [2000,3000)
    const s = slidingWindow(spyStore as any);
    await s.consume('k', ctx());

    vi.setSystemTime(4000); // window [4000,5000); stale window start = 4000 - 2000 = 2000
    await s.consume('k', ctx());

    expect(resetCalls).toContain('k:2000');
  });
});
