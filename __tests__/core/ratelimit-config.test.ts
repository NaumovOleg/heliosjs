import { afterEach, describe, expect, it } from 'vitest';
import { getRateLimitConfig, setRateLimitConfig } from '@heliosjs/core/utils';

afterEach(() => setRateLimitConfig(undefined));

describe('rate-limit config holder', () => {
  it('is undefined by default', () => {
    expect(getRateLimitConfig()).toBeUndefined();
  });

  it('stores and returns the config', () => {
    const cfg = { keyGen: () => 'k' };
    setRateLimitConfig(cfg);
    expect(getRateLimitConfig()).toBe(cfg);
  });

  it('clears when set to undefined', () => {
    setRateLimitConfig({ keyGen: () => 'k' });
    setRateLimitConfig(undefined);
    expect(getRateLimitConfig()).toBeUndefined();
  });
});
