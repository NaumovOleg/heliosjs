import { describe, expect, it } from 'vitest';
import { GrpcError, GrpcInvalidProtoError, GrpcServiceNotFoundError } from '../../../src/grpc/src/utils/grpc/errors';
import { normalizeError, toPromise } from '../../../src/grpc/src/utils/grpc/helpers';
import { status } from '@grpc/grpc-js';
import { Observable } from 'rxjs';

describe('GrpcError classes', () => {
  it('GrpcError sets code and message', () => {
    const err = new GrpcError(13, 'test error');
    expect(err.code).toBe(13);
    expect(err.message).toBe('test error');
    expect(err.name).toBe('GrpcError');
    expect(err).toBeInstanceOf(Error);
  });

  it('GrpcError accepts metadata', () => {
    const err = new GrpcError(1, 'err', { key: 'val' });
    expect(err.metadata).toEqual({ key: 'val' });
  });

  it('GrpcInvalidProtoError uses code 13', () => {
    const err = new GrpcInvalidProtoError('test.proto');
    expect(err.code).toBe(13);
    expect(err.message).toContain('test.proto');
    expect(err.name).toBe('GrpcInvalidProtoError');
  });

  it('GrpcServiceNotFoundError uses code 5', () => {
    const err = new GrpcServiceNotFoundError('UserService');
    expect(err.code).toBe(5);
    expect(err.message).toContain('UserService');
    expect(err.name).toBe('GrpcServiceNotFoundError');
  });
});

describe('normalizeError', () => {
  it('normalizes gRPC-style errors', () => {
    const err = { code: 13, message: 'parse error' };
    expect(normalizeError(err)).toEqual({ code: 13, message: 'parse error' });
  });

  it('maps HTTP status codes to gRPC codes', () => {
    expect(normalizeError({ statusCode: 400, message: 'bad' })).toEqual({ code: status.INVALID_ARGUMENT, message: 'bad' });
    expect(normalizeError({ statusCode: 401, message: 'unauth' })).toEqual({ code: status.UNAUTHENTICATED, message: 'unauth' });
    expect(normalizeError({ statusCode: 403, message: 'forbidden' })).toEqual({ code: status.PERMISSION_DENIED, message: 'forbidden' });
    expect(normalizeError({ statusCode: 404, message: 'not found' })).toEqual({ code: status.NOT_FOUND, message: 'not found' });
    expect(normalizeError({ statusCode: 409, message: 'conflict' })).toEqual({ code: status.ALREADY_EXISTS, message: 'conflict' });
    expect(normalizeError({ statusCode: 429, message: 'too many' })).toEqual({ code: status.RESOURCE_EXHAUSTED, message: 'too many' });
    expect(normalizeError({ statusCode: 501, message: 'no impl' })).toEqual({ code: status.UNIMPLEMENTED, message: 'no impl' });
    expect(normalizeError({ statusCode: 503, message: 'unavail' })).toEqual({ code: status.UNAVAILABLE, message: 'unavail' });
  });

  it('maps unknown HTTP status to INTERNAL', () => {
    expect(normalizeError({ statusCode: 418, message: 'teapot' })).toEqual({ code: status.INTERNAL, message: 'teapot' });
  });

  it('falls back to INTERNAL for unknown errors', () => {
    expect(normalizeError(new Error('oops'))).toEqual({ code: status.INTERNAL, message: 'oops' });
  });

  it('handles errors without message', () => {
    expect(normalizeError({})).toEqual({ code: status.INTERNAL, message: 'Internal server error' });
  });
});

describe('toPromise', () => {
  it('returns promise directly if already a promise', async () => {
    const p = Promise.resolve('hello');
    expect(await toPromise(p)).toBe('hello');
  });

  it('converts observable to promise', async () => {
    const obs = new Observable<string>((subscriber) => {
      setTimeout(() => {
        subscriber.next('value');
        subscriber.complete();
      }, 0);
    });
    expect(await toPromise(obs)).toBe('value');
  });

  it('rejects if observable completes without value', async () => {
    const obs = new Observable<string>((subscriber) => {
      setTimeout(() => subscriber.complete(), 0);
    });
    await expect(toPromise(obs)).rejects.toThrow('without emitting');
  });

  it('rejects on observable error', async () => {
    const obs = new Observable<string>((subscriber) => {
      setTimeout(() => subscriber.error(new Error('obs err')), 0);
    });
    await expect(toPromise(obs)).rejects.toThrow('obs err');
  });
});
