import { describe, it, expect } from 'vitest';
import { MultipartProcessor } from '../../../../src/core/src/utils/core/multipart';

describe('MultipartProcessor.parse', () => {
  it('returns empty when body is falsy', () => {
    const result = MultipartProcessor.parse({ body: undefined, headers: {}, isBase64Encoded: false });
    expect(result).toEqual({ fields: {}, files: {} });
  });

  it('returns empty when body is null', () => {
    const result = MultipartProcessor.parse({ body: null as any, headers: {}, isBase64Encoded: false });
    expect(result).toEqual({ fields: {}, files: {} });
  });

  it('throws when content-type is not multipart', () => {
    expect(() =>
      MultipartProcessor.parse({ body: 'test', headers: { 'content-type': 'text/plain' }, isBase64Encoded: false })
    ).toThrow('Not a multipart request');
  });

  it('throws when content-type array first element is not multipart', () => {
    expect(() =>
      MultipartProcessor.parse({ body: 'test', headers: { 'content-type': ['text/plain'] }, isBase64Encoded: false })
    ).toThrow('Not a multipart request');
  });

  it('handles object body by converting to JSON buffer', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(result.fields.field1).toBe('value1');
  });

  it('parses JSON field values', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n{"key":"value"}\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(result.fields.data).toEqual({ key: 'value' });
  });

  it('parses non-JSON field as string', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nJohn Doe\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(result.fields.name).toBe('John Doe');
  });

  it('parses file upload', () => {
    const boundary = '----TestBoundary';
    const fileContent = Buffer.from('file content');
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n${fileContent}\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(result.files.file).toBeDefined();
    expect((result.files.file as any).filename).toBe('test.txt');
  });

  it('parses multiple files with same fieldname into array', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\naaa\r\n--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nbbb\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(Array.isArray(result.files.files)).toBe(true);
    expect((result.files.files as any[]).length).toBe(2);
  });

  it('file uses "file" as default fieldname when name is provided', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\ncontent\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    expect(result.files.file).toBeDefined();
  });

  it('handles base64 encoded body', () => {
    const boundary = '----TestBoundary';
    const original = `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nhello\r\n--${boundary}--\r\n`;
    const encoded = Buffer.from(original).toString('base64');
    const result = MultipartProcessor.parse({
      body: encoded,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: true,
    });
    expect(result.fields.field).toBe('hello');
  });

  it('handles content-type as array', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="f"\r\n\r\nv\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': [`multipart/form-data; boundary=${boundary}`] },
      isBase64Encoded: false,
    });
    expect(result.fields.f).toBe('v');
  });

  it('maps known file extensions to MIME types', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\npngdata\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    const file = result.files.file as any;
    expect(file.contentType).toBe('image/png');
  });

  it('falls back to part.type when extension not in mimeMap', () => {
    const boundary = '----TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.xyz"\r\nContent-Type: application/octet-stream\r\n\r\ndata\r\n--${boundary}--\r\n`;
    const result = MultipartProcessor.parse({
      body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      isBase64Encoded: false,
    });
    const file = result.files.file as any;
    expect(file.contentType).toBe('application/octet-stream');
  });
});

describe('MultipartProcessor.isMultipart', () => {
  it('returns true for multipart content type', () => {
    expect(MultipartProcessor.isMultipart({ headers: { 'content-type': 'multipart/form-data' } } as any)).toBe(true);
  });

  it('returns true for uppercase Content-Type', () => {
    expect(MultipartProcessor.isMultipart({ headers: { 'Content-Type': 'multipart/form-data' } } as any)).toBe(true);
  });

  it('returns false for non-multipart', () => {
    expect(MultipartProcessor.isMultipart({ headers: { 'content-type': 'application/json' } } as any)).toBe(false);
  });

  it('returns false when no headers', () => {
    expect(MultipartProcessor.isMultipart({ headers: undefined } as any)).toBe(false);
  });

  it('handles content-type as array', () => {
    expect(MultipartProcessor.isMultipart({ headers: { 'content-type': ['multipart/form-data'] } } as any)).toBe(true);
  });
});
