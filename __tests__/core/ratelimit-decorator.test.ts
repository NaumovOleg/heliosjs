import { describe, expect, it } from 'vitest';
import { RateLimit } from '@heliosjs/core';
import { reflectMiddlewaresMetadata } from '@heliosjs/core/utils';

describe('@RateLimit', () => {
  it('attaches a rateLimit item to method metadata', () => {
    class Ctrl {
      @RateLimit({ max: 5, windowMs: 1000 })
      handler() {}
    }
    const items = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(items).toHaveLength(1);
    expect(items[0].rateLimit).toEqual({ max: 5, windowMs: 1000 });
  });

  it('attaches a rateLimit item to class metadata when used as a class decorator', () => {
    @RateLimit({ max: 10, windowMs: 2000 })
    class Ctrl {}
    const items = reflectMiddlewaresMetadata(Ctrl);
    expect(items).toHaveLength(1);
    expect(items[0].rateLimit).toEqual({ max: 10, windowMs: 2000 });
  });

  it('throws a TypeError for non-positive max or windowMs', () => {
    expect(() => RateLimit({ max: 0, windowMs: 1000 })).toThrow(TypeError);
    expect(() => RateLimit({ max: 5, windowMs: 0 })).toThrow(TypeError);
  });
});
