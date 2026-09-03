import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { enforceRateLimit } from '../../../../src/core/src/utils/core/ratelimit/enforce';
import { setRateLimitConfig } from '../../../../src/core/src/utils/core/ratelimit/config';
import { fixedWindow } from '../../../../src/core/src/utils/core/ratelimit/strategies';
import { makeRequest, makeResponse, makeRoute } from '../../../helpers/http';

describe('enforceRateLimit', () => {
  beforeEach(() => {
    setRateLimitConfig(undefined);
  });

  afterEach(() => {
    setRateLimitConfig(undefined);
  });

  it('does nothing when no rateLimit items on route', async () => {
    const req = makeRequest() as any;
    const res = makeResponse() as any;
    const route = makeRoute({ functions: [] });
    await enforceRateLimit(req, res, route);
    expect(res.headers['X-RateLimit-Limit']).toBeUndefined();
  });

  it('sets rate limit headers on successful request', async () => {
    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-headers',
      functions: [{ rateLimit: { max: 10, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);

    expect(res.headers['X-RateLimit-Limit']).toBe('10');
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(res.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('throws RateLimitExceededError when limit exceeded', async () => {
    const strategy = fixedWindow();
    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-throw',
      functions: [{ rateLimit: { max: 1, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    await expect(enforceRateLimit(req, res, route)).rejects.toThrow('Rate limit exceeded');
  });

  it('uses global strategy from config', async () => {
    const strategy = fixedWindow();
    const consumeSpy = vi.spyOn(strategy, 'consume');
    setRateLimitConfig({ strategy } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-global-strategy',
      functions: [{ rateLimit: { max: 100, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    expect(consumeSpy).toHaveBeenCalled();
  });

  it('method-level strategy overrides global', async () => {
    const globalStrategy = fixedWindow();
    const methodStrategy = fixedWindow();
    const globalSpy = vi.spyOn(globalStrategy, 'consume');
    const methodSpy = vi.spyOn(methodStrategy, 'consume');

    setRateLimitConfig({ strategy: globalStrategy } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-method-strategy',
      functions: [{ rateLimit: { max: 100, windowMs: 60_000, strategy: methodStrategy } }],
    });

    await enforceRateLimit(req, res, route);
    expect(methodSpy).toHaveBeenCalled();
    expect(globalSpy).not.toHaveBeenCalled();
  });

  it('calls onLimit callback when limit is exceeded', async () => {
    const onLimit = vi.fn();
    setRateLimitConfig({ onLimit } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-onlimit',
      functions: [{ rateLimit: { max: 1, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    await expect(enforceRateLimit(req, res, route)).rejects.toThrow();
    expect(onLimit).toHaveBeenCalled();
  });

  it('uses custom keyGen when provided', async () => {
    const keyGen = vi.fn(() => 'custom-key');
    setRateLimitConfig({ keyGen } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-keygen',
      functions: [{ rateLimit: { max: 100, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    expect(keyGen).toHaveBeenCalled();
  });

  it('respects cost parameter', async () => {
    const strategy = fixedWindow();
    const consumeSpy = vi.spyOn(strategy, 'consume');

    setRateLimitConfig({ strategy } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-cost',
      functions: [{ rateLimit: { max: 10, windowMs: 60_000, cost: 5 } }],
    });

    await enforceRateLimit(req, res, route);
    expect(consumeSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cost: 5 }),
    );
  });

  it('sets Retry-After header when limit exceeded', async () => {
    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-retry-after',
      functions: [{ rateLimit: { max: 1, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    await expect(enforceRateLimit(req, res, route)).rejects.toThrow();
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('last rateLimit item wins for max/windowMs', async () => {
    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-merge',
      functions: [
        { rateLimit: { max: 5, windowMs: 1000 } },
        { rateLimit: { max: 20, windowMs: 30_000 } },
      ],
    });

    await enforceRateLimit(req, res, route);
    expect(res.headers['X-RateLimit-Limit']).toBe('20');
  });

  it('swallows onLimit callback errors', async () => {
    const onLimit = vi.fn(() => {
      throw new Error('onLimit crash');
    });
    setRateLimitConfig({ onLimit } as any);

    const req = makeRequest({ headers: { origin: 'http://localhost' } }) as any;
    const res = makeResponse() as any;
    const route = makeRoute({
      method: 'GET',
      route: '/enforce-onlimit-crash',
      functions: [{ rateLimit: { max: 1, windowMs: 60_000 } }],
    });

    await enforceRateLimit(req, res, route);
    await expect(enforceRateLimit(req, res, route)).rejects.toThrow('Rate limit exceeded');
  });
});
