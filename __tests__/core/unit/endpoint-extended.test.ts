import { describe, it, expect } from 'vitest';
import { pathStartsWithPrefix } from '../../../src/core/src/utils/core/endpoint';

describe('pathStartsWithPrefix', () => {
  it('returns true when path starts with prefix', () => {
    expect(pathStartsWithPrefix('/api/users', '/api')).toBe(true);
  });

  it('returns true for exact match', () => {
    expect(pathStartsWithPrefix('/api', '/api')).toBe(true);
  });

  it('returns false when prefix is longer than path', () => {
    expect(pathStartsWithPrefix('/api', '/api/users')).toBe(false);
  });

  it('returns false when path does not match prefix', () => {
    expect(pathStartsWithPrefix('/users', '/api')).toBe(false);
  });

  it('handles trailing slashes', () => {
    expect(pathStartsWithPrefix('/api/users/', '/api')).toBe(true);
  });

  it('handles empty path segments', () => {
    expect(pathStartsWithPrefix('///api///users', '/api')).toBe(true);
  });

  it('returns true for empty prefix', () => {
    expect(pathStartsWithPrefix('/anything', '/')).toBe(true);
  });
});
