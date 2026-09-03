import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RateLimit } from '@heliosjs/core';

const MIDDLEWARES_META = 'controller:middlewares';

function getMeta(target: any, propertyKey?: string) {
  if (propertyKey) {
    return Reflect.getMetadata(MIDDLEWARES_META, target, propertyKey);
  }
  return Reflect.getMetadata(MIDDLEWARES_META, target);
}

describe('@RateLimit decorator', () => {
  it('throws TypeError when max is 0', () => {
    expect(() => {
      @RateLimit({ max: 0, windowMs: 60000 })
      class Ctrl {}
    }).toThrow(TypeError);
  });

  it('throws TypeError when max is negative', () => {
    expect(() => {
      @RateLimit({ max: -1, windowMs: 60000 })
      class Ctrl {}
    }).toThrow(TypeError);
  });

  it('throws TypeError when windowMs is 0', () => {
    expect(() => {
      @RateLimit({ max: 10, windowMs: 0 })
      class Ctrl {}
    }).toThrow(TypeError);
  });

  it('throws TypeError when windowMs is negative', () => {
    expect(() => {
      @RateLimit({ max: 10, windowMs: -1000 })
      class Ctrl {}
    }).toThrow(TypeError);
  });

  it('sets rate limit on class level', () => {
    const opts = { max: 100, windowMs: 60000 };
    @RateLimit(opts)
    class Ctrl {}
    const meta = getMeta(Ctrl);
    expect(meta).toBeDefined();
    expect(meta.some((m: any) => m.rateLimit === opts)).toBe(true);
  });

  it('sets rate limit on method level', () => {
    const opts = { max: 5, windowMs: 1000 };
    class Ctrl {
      @RateLimit(opts)
      handler() {}
    }
    const meta = getMeta(Ctrl.prototype, 'handler');
    expect(meta).toBeDefined();
    expect(meta.some((m: any) => m.rateLimit === opts)).toBe(true);
  });
});
