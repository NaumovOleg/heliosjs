import { describe, expect, it } from 'vitest';
import { Controller, Get, RateLimit } from '@heliosjs/core';
import { fixedWindow, MemoryStore, reflectMiddlewaresMetadata } from '@heliosjs/core/utils';

describe('class-level @RateLimit', () => {
  it('attaches rate-limit metadata to the controller constructor', () => {
    @RateLimit({ max: 3, windowMs: 1000, strategy: fixedWindow(new MemoryStore()) })
    @Controller('/api')
    class ApiController {
      @Get('/ping')
      ping() {
        return 'pong';
      }
    }

    // metadata lives on the constructor; reflect-metadata walks the prototype chain
    const items = reflectMiddlewaresMetadata(ApiController);
    const rl = items.find((i) => i.rateLimit);
    expect(rl?.rateLimit?.max).toBe(3);
  });
});
