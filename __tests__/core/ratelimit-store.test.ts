import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@heliosjs/core/utils';

describe('MemoryStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns undefined for an unknown key', async () => {
    const store = new MemoryStore();
    expect(await store.get('missing')).toBeUndefined();
  });

  it('stores and returns a copy of the state', async () => {
    const store = new MemoryStore();
    const state = { count: 3, resetAt: Date.now() + 1000 };
    await store.set('k', state, 1000);
    const got = await store.get('k');
    expect(got).toEqual(state);
    expect(got).not.toBe(state); // defensive copy
  });

  it('evicts an entry lazily after its ttl elapses', async () => {
    const store = new MemoryStore();
    await store.set('k', { count: 1, resetAt: Date.now() + 50 }, 50);
    vi.advanceTimersByTime(51);
    expect(await store.get('k')).toBeUndefined();
  });

  it('reset() drops the entry', async () => {
    const store = new MemoryStore();
    await store.set('k', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.reset('k');
    expect(await store.get('k')).toBeUndefined();
  });

  it('caps entries and evicts the oldest-written on overflow', async () => {
    const store = new MemoryStore(2);
    await store.set('a', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.set('b', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.set('c', { count: 1, resetAt: Date.now() + 1000 }, 1000); // evicts 'a'
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeDefined();
    expect(await store.get('c')).toBeDefined();
  });

  it('re-writing a key refreshes its recency', async () => {
    const store = new MemoryStore(2);
    await store.set('a', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.set('b', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.set('a', { count: 2, resetAt: Date.now() + 1000 }, 1000); // 'a' now newest
    await store.set('c', { count: 1, resetAt: Date.now() + 1000 }, 1000); // evicts 'b'
    expect(await store.get('b')).toBeUndefined();
    expect((await store.get('a'))?.count).toBe(2);
  });
});
