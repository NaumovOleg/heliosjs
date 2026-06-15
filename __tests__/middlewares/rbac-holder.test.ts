import { afterEach, describe, expect, it } from 'vitest';
import { getRolesExtractor, setRolesExtractor } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

afterEach(() => setRolesExtractor(undefined));

describe('roles extractor holder', () => {
  it('is undefined before being set', () => {
    expect(getRolesExtractor()).toBeUndefined();
  });

  it('returns the extractor after set', () => {
    const fn = (_req: Request) => ['admin'];
    setRolesExtractor(fn);
    expect(getRolesExtractor()).toBe(fn);
  });

  it('clears when set to undefined', () => {
    setRolesExtractor((_req: Request) => 'admin');
    setRolesExtractor(undefined);
    expect(getRolesExtractor()).toBeUndefined();
  });
});
