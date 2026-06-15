import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenBucket, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 3, // capacity
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('tokenBucket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows a burst up to capacity then blocks', async () => {
    const s = tokenBucket({ refillRate: 1 }, new MemoryStore());
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 3 -> 2
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 2 -> 1
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 1 -> 0
    expect((await s.consume('k', ctx())).allowed).toBe(false); // empty
  });

  it('refills over time at refillRate tokens/sec', async () => {
    const s = tokenBucket({ refillRate: 2 }, new MemoryStore()); // 2 tokens/sec
    await s.consume('k', ctx({ max: 1 })); // capacity 1 -> empty
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(false);
    vi.advanceTimersByTime(500); // 0.5s * 2 = 1 token
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(true);
  });

  it('consumes multiple tokens when cost > 1', async () => {
    const s = tokenBucket({ refillRate: 1 }, new MemoryStore());
    const r = await s.consume('k', ctx({ max: 3, cost: 2 })); // 3 -> 1
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
    expect((await s.consume('k', ctx({ max: 3, cost: 2 }))).allowed).toBe(false); // only 1 left
  });
});
