import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@heliosjs/core/utils';

describe('vitest + core alias', () => {
  it('resolves core source through alias', () => {
    expect(typeof ForbiddenError).toBe('function');
  });
});
