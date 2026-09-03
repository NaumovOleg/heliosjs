import { describe, expect, it } from 'vitest';
import { MultipartProcessor } from '@heliosjs/core/utils';

describe('MultipartProcessor.isMultipart', () => {
  it('returns true for multipart content type', () => {
    expect(MultipartProcessor.isMultipart({
      headers: { 'Content-Type': 'multipart/form-data; boundary=abc' },
    } as any)).toBe(true);
  });

  it('returns true for lowercase content-type', () => {
    expect(MultipartProcessor.isMultipart({
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
    } as any)).toBe(true);
  });

  it('returns true for array content-type', () => {
    expect(MultipartProcessor.isMultipart({
      headers: { 'Content-Type': ['multipart/form-data; boundary=abc'] },
    } as any)).toBe(true);
  });

  it('returns false for non-multipart', () => {
    expect(MultipartProcessor.isMultipart({
      headers: { 'Content-Type': 'application/json' },
    } as any)).toBe(false);
  });

  it('returns false for missing content-type', () => {
    expect(MultipartProcessor.isMultipart({
      headers: {},
    } as any)).toBe(false);
  });
});

describe('MultipartProcessor.parse', () => {
  it('returns empty for null body', () => {
    const result = MultipartProcessor.parse({
      body: null,
      headers: {},
      isBase64Encoded: false,
    });
    expect(result).toEqual({ fields: {}, files: {} });
  });

  it('throws for non-multipart content type', () => {
    expect(() => MultipartProcessor.parse({
      body: 'data',
      headers: { 'Content-Type': 'application/json' },
      isBase64Encoded: false,
    })).toThrow('Not a multipart request');
  });

  it('throws for missing boundary', () => {
    expect(() => MultipartProcessor.parse({
      body: 'data',
      headers: { 'Content-Type': 'multipart/form-data' },
      isBase64Encoded: false,
    })).toThrow();
  });

  it('parses multipart form data with fields', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="name"',
      '',
      'John Doe',
      `--${boundary}`,
      'Content-Disposition: form-data; name="age"',
      '',
      '30',
      `--${boundary}--`,
    ].join('\r\n');

    const result = MultipartProcessor.parse({
      body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });

    expect(result.fields.name).toBe('John Doe');
    // age is auto-parsed as JSON number
    expect(result.fields.age).toBe(30);
  });

  it('parses JSON fields', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="data"',
      '',
      '{"key":"value"}',
      `--${boundary}--`,
    ].join('\r\n');

    const result = MultipartProcessor.parse({
      body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });

    expect(result.fields.data).toEqual({ key: 'value' });
  });

  it('handles Buffer body', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field"',
      '',
      'value',
      `--${boundary}--`,
    ].join('\r\n');

    const result = MultipartProcessor.parse({
      body: Buffer.from(body),
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });

    expect(result.fields.field).toBe('value');
  });

  it('handles base64 encoded body', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field"',
      '',
      'value',
      `--${boundary}--`,
    ].join('\r\n');

    const result = MultipartProcessor.parse({
      body: Buffer.from(body).toString('base64'),
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: true,
    });

    expect(result.fields.field).toBe('value');
  });

  it('handles array content-type', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field"',
      '',
      'value',
      `--${boundary}--`,
    ].join('\r\n');

    const result = MultipartProcessor.parse({
      body,
      headers: { 'Content-Type': [`multipart/form-data; boundary=${boundary}`] },
      isBase64Encoded: false,
    });

    expect(result.fields.field).toBe('value');
  });
});
