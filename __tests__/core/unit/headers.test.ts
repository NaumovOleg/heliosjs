import { describe, expect, it } from 'vitest';
import { getOrigin } from '@heliosjs/core/utils';
import { makeRequest } from '../../helpers/http';

function req(headers: Record<string, string | string[]> = {}) {
  return makeRequest({ headers }) as any;
}

describe('getOrigin', () => {
  it('returns origin header (lowercase)', () => {
    expect(getOrigin(req({ origin: 'http://localhost' }))).toBe('http://localhost');
  });

  it('returns Origin header (capitalized)', () => {
    expect(getOrigin(req({ Origin: 'http://example.com' }))).toBe('http://example.com');
  });

  it('returns undefined when no origin header', () => {
    expect(getOrigin(req({}))).toBeUndefined();
  });

  it('takes first element from array origin header', () => {
    expect(getOrigin(req({ origin: ['http://a.com', 'http://b.com'] }))).toBe('http://a.com');
  });

  it('returns undefined when origin header is empty string (falsy)', () => {
    expect(getOrigin(req({ origin: '' }))).toBeUndefined();
  });
});
