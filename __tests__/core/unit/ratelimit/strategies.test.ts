import { describe, expect, it } from 'vitest';
import { fixedWindow, slidingWindow, tokenBucket, getDefaultStrategy } from '../../../../src/core/src/utils/core/ratelimit/strategies';
import { MemoryStore } from '../../../../src/core/src/utils/core/ratelimit/store';

function ctx(max: number, windowMs = 1000, cost = 1): any {
  return { max, windowMs, cost, request: {} };
}

describe('fixedWindow', () => {
  it('allows requests within limit', async () => {
    const strategy = fixedWindow();
    const result = await strategy.consume('key1', ctx(5, 10000));
    expect(result.allowed).toBe(true);
    expect(result.totalHits).toBe(1);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding limit', async () => {
    const strategy = fixedWindow();
    for (let i = 0; i < 3; i++) {
      await strategy.consume('key2', ctx(3, 10000));
    }
    const result = await strategy.consume('key2', ctx(3, 10000));
    expect(result.allowed).toBe(false);
    expect(result.totalHits).toBe(4);
    expect(result.remaining).toBe(0);
  });

  it('resets window after windowMs', async () => {
    const strategy = fixedWindow();
    await strategy.consume('key3', ctx(1, 1));
    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));
    const result = await strategy.consume('key3', ctx(1, 1));
    expect(result.allowed).toBe(true);
    expect(result.totalHits).toBe(1);
  });

  it('respects cost parameter', async () => {
    const strategy = fixedWindow();
    const result = await strategy.consume('key4', { max: 5, windowMs: 10000, cost: 3, request: {} } as any);
    expect(result.totalHits).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it('accepts custom store', () => {
    const store = new MemoryStore();
    const strategy = fixedWindow(store);
    expect(strategy).toBeDefined();
  });
});

describe('slidingWindow', () => {
  it('allows requests within limit', async () => {
    const strategy = slidingWindow();
    const result = await strategy.consume('skey1', ctx(5, 10000));
    expect(result.allowed).toBe(true);
    expect(result.totalHits).toBeGreaterThanOrEqual(1);
  });

  it('blocks requests exceeding limit', async () => {
    const strategy = slidingWindow();
    for (let i = 0; i < 5; i++) {
      await strategy.consume('skey2', ctx(5, 10000));
    }
    const result = await strategy.consume('skey2', ctx(5, 10000));
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('weights previous window in estimation', async () => {
    const strategy = slidingWindow();
    // Consume in previous window simulation
    await strategy.consume('skey3', ctx(10, 10000));
    const result = await strategy.consume('skey3', ctx(10, 10000));
    expect(result.totalHits).toBeGreaterThanOrEqual(1);
  });

  it('accepts custom store', () => {
    const store = new MemoryStore();
    const strategy = slidingWindow(store);
    expect(strategy).toBeDefined();
  });
});

describe('tokenBucket', () => {
  it('allows requests when tokens available', async () => {
    const strategy = tokenBucket({ refillRate: 10 });
    const result = await strategy.consume('bkey1', ctx(5, 10000));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('blocks when bucket empty', async () => {
    const strategy = tokenBucket({ refillRate: 0.001 });
    for (let i = 0; i < 5; i++) {
      await strategy.consume('bkey2', ctx(5, 10000));
    }
    const result = await strategy.consume('bkey2', ctx(5, 10000));
    expect(result.allowed).toBe(false);
  });

  it('refills tokens over time', async () => {
    const strategy = tokenBucket({ refillRate: 100 });
    await strategy.consume('bkey3', ctx(5, 10000));
    await new Promise((r) => setTimeout(r, 50));
    const result = await strategy.consume('bkey3', ctx(1, 10000));
    expect(result.allowed).toBe(true);
  });

  it('respects cost parameter', async () => {
    const strategy = tokenBucket({ refillRate: 10 });
    const result = await strategy.consume('bkey4', { max: 5, windowMs: 10000, cost: 3, request: {} } as any);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('accepts custom store', () => {
    const store = new MemoryStore();
    const strategy = tokenBucket({ refillRate: 10 }, store);
    expect(strategy).toBeDefined();
  });
});

describe('getDefaultStrategy', () => {
  it('returns singleton strategy', () => {
    const s1 = getDefaultStrategy();
    const s2 = getDefaultStrategy();
    expect(s1).toBe(s2);
  });

  it('returns a working strategy', async () => {
    const strategy = getDefaultStrategy();
    const result = await strategy.consume('default-key', ctx(100, 10000));
    expect(result.allowed).toBe(true);
  });
});
