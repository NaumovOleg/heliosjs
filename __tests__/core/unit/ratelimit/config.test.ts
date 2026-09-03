import { describe, expect, it, afterEach } from 'vitest';
import { setRateLimitConfig, getRateLimitConfig } from '../../../../src/core/src/utils/core/ratelimit/config';

describe('rateLimit config', () => {
  afterEach(() => {
    setRateLimitConfig(undefined);
  });

  it('returns undefined by default', () => {
    expect(getRateLimitConfig()).toBeUndefined();
  });

  it('stores and retrieves config', () => {
    const cfg = { max: 100, windowMs: 60_000 };
    setRateLimitConfig(cfg as any);
    expect(getRateLimitConfig()).toBe(cfg);
  });

  it('overwrites previous config', () => {
    const cfg1 = { max: 10, windowMs: 1000 };
    const cfg2 = { max: 20, windowMs: 2000 };
    setRateLimitConfig(cfg1 as any);
    setRateLimitConfig(cfg2 as any);
    expect(getRateLimitConfig()).toBe(cfg2);
  });

  it('clears config when set to undefined', () => {
    setRateLimitConfig({ max: 10, windowMs: 1000 } as any);
    setRateLimitConfig(undefined);
    expect(getRateLimitConfig()).toBeUndefined();
  });
});
