import { describe, expect, it } from 'vitest';
import { beforeRequest, RateLimitExceededError } from '@heliosjs/core/utils';
import { fixedWindow, MemoryStore } from '@heliosjs/core/utils';
import { makeRequest, makeResponse, makeRoute } from '../helpers/http';

describe('rate limiting via beforeRequest', () => {
  it('allows up to max requests then throws on the next', async () => {
    const strategy = fixedWindow(new MemoryStore());
    const route = makeRoute({
      functions: [{ rateLimit: { max: 2, windowMs: 1000, strategy, keyGen: () => 'ip' } }],
    });

    const res1 = makeResponse();
    await beforeRequest(makeRequest(), res1, route);
    expect(res1.headers['X-RateLimit-Remaining']).toBe('1');

    await beforeRequest(makeRequest(), makeResponse(), route);

    await expect(
      beforeRequest(makeRequest(), makeResponse(), route),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it('runs the rate limit before guards', async () => {
    let guardRan = false;
    const strategy = fixedWindow(new MemoryStore());
    const route = makeRoute({
      functions: [
        { rateLimit: { max: 1, windowMs: 1000, strategy, keyGen: () => 'ip' } },
        {
          guard: () => {
            guardRan = true;
            return true;
          },
        },
      ],
    });
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(guardRan).toBe(true);

    guardRan = false;
    await beforeRequest(makeRequest(), makeResponse(), route).catch(() => undefined);
    expect(guardRan).toBe(false);
  });
});
