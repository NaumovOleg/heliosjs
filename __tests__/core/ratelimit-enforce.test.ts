import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enforceRateLimit,
  RateLimitExceededError,
  setRateLimitConfig,
} from '@heliosjs/core/utils';
import type { RateLimitRecord, RateLimitStrategy } from '@heliosjs/core/types';
import { makeRequest, makeResponse, makeRoute } from '../helpers/http';

afterEach(() => setRateLimitConfig(undefined));

function fakeStrategy(record: RateLimitRecord): RateLimitStrategy & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    async consume(key, ctx) {
      calls.push({ key, ctx });
      return record;
    },
  };
}

const allow: RateLimitRecord = { totalHits: 1, remaining: 4, resetAt: 10_000, allowed: true };
const deny: RateLimitRecord = { totalHits: 6, remaining: 0, resetAt: 10_000, allowed: false };

describe('enforceRateLimit', () => {
  it('does nothing when there is no rateLimit item and no global config', async () => {
    const res = makeResponse();
    await enforceRateLimit(makeRequest(), res, makeRoute());
    expect(res.headers).toEqual({});
  });

  it('sets X-RateLimit headers on an allowed request', async () => {
    const strategy = fakeStrategy(allow);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy } }],
    });
    const res = makeResponse();
    await enforceRateLimit(makeRequest(), res, route);
    expect(res.headers['X-RateLimit-Limit']).toBe('5');
    expect(res.headers['X-RateLimit-Remaining']).toBe('4');
    expect(res.headers['X-RateLimit-Reset']).toBe('10');
    expect(res.headers['Retry-After']).toBeUndefined();
  });

  it('throws RateLimitExceededError and sets Retry-After on a denied request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const strategy = fakeStrategy(deny);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy } }],
    });
    const res = makeResponse();
    await expect(enforceRateLimit(makeRequest(), res, route)).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
    expect(res.headers['Retry-After']).toBe('5'); // (10000 - 5000)/1000
    vi.useRealTimers();
  });

  it('invokes onLimit once on a denied request', async () => {
    const onLimit = vi.fn();
    const strategy = fakeStrategy(deny);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy, onLimit } }],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route).catch(() => undefined);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it('lets the method item win over the controller item (precedence)', async () => {
    const controller = fakeStrategy(allow);
    const method = fakeStrategy(allow);
    const route = makeRoute({
      functions: [
        { rateLimit: { max: 100, windowMs: 1000, strategy: controller } },
        { rateLimit: { max: 5, windowMs: 1000, strategy: method } },
      ],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(method.calls).toHaveLength(1);
    expect(method.calls[0].ctx.max).toBe(5);
    expect(controller.calls).toHaveLength(0);
  });

  it('uses the global strategy when only global config is set with a decorator', async () => {
    const global = fakeStrategy(allow);
    setRateLimitConfig({ strategy: global });
    const route = makeRoute({ functions: [{ rateLimit: { max: 5, windowMs: 1000 } }] });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(global.calls).toHaveLength(1);
  });

  it('builds the key from keyGen prefixed by the route id', async () => {
    const strategy = fakeStrategy(allow);
    const route = makeRoute({
      method: 'GET',
      route: '/users',
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy, keyGen: () => 'abc' } }],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(strategy.calls[0].key).toBe('GET /users:abc');
  });

  it('still throws RateLimitExceededError when onLimit itself throws', async () => {
    const strategy = fakeStrategy(deny);
    const onLimit = () => {
      throw new Error('hook boom');
    };
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy, onLimit } }],
    });
    await expect(
      enforceRateLimit(makeRequest(), makeResponse(), route),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });
});
