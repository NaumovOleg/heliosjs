import { describe, expect, it } from 'vitest';
import { parseCloudFrontHeaders } from '../../../src/aws/src/utils/aws/parsers';

describe('parseCloudFrontHeaders', () => {
  it('returns empty object for undefined headers', () => {
    expect(parseCloudFrontHeaders(undefined)).toEqual({});
  });

  it('returns empty object for empty headers', () => {
    expect(parseCloudFrontHeaders({})).toEqual({});
  });

  it('parses single-value header', () => {
    const headers = { 'content-type': [{ key: 'Content-Type', value: 'application/json' }] };
    expect(parseCloudFrontHeaders(headers)).toEqual({ 'content-type': 'application/json' });
  });

  it('parses multi-value header as array', () => {
    const headers = {
      'accept-encoding': [
        { key: 'Accept-Encoding', value: 'gzip' },
        { key: 'Accept-Encoding', value: 'deflate' },
      ],
    };
    const result = parseCloudFrontHeaders(headers);
    expect(result['accept-encoding']).toEqual(['gzip', 'deflate']);
  });

  it('handles header with empty value array', () => {
    const headers = { 'x-empty': [] };
    const result = parseCloudFrontHeaders(headers);
    expect(result['x-empty']).toBe('');
  });

  it('handles header with value missing key', () => {
    const headers = { host: [{ value: 'example.com' }] };
    const result = parseCloudFrontHeaders(headers);
    expect(result.host).toBe('example.com');
  });
});
