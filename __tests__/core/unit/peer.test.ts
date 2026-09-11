import { describe, expect, it } from 'vitest';
// Not exported from @heliosjs/core/utils on purpose (@internal) — reach it by
// relative path, same as validate.ts/sanitize.ts do.
import { lazyPeer } from '../../../src/core/src/utils/shared/peer';

describe('lazyPeer', () => {
  it('loads and caches a real module', () => {
    const getPath = lazyPeer<typeof import('node:path')>('node:path', 'test feature');
    const first = getPath();
    const second = getPath();
    expect(first).toBe(second); // same cached instance
    expect(typeof first.join).toBe('function');
  });

  it('throws a clear error naming the feature and package when missing', () => {
    const getMissing = lazyPeer('definitely-not-a-real-package-xyz', 'Some feature');
    expect(() => getMissing()).toThrow(
      "Some feature needs the optional 'definitely-not-a-real-package-xyz' peer dependency — install it: npm install definitely-not-a-real-package-xyz"
    );
  });
});
