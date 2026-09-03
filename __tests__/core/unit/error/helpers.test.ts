import { describe, expect, it, vi } from 'vitest';
import { serializeError, isError, getErrorType } from '@heliosjs/core/utils';
import { BaseError, ValidationError as HeliosValidationError, UnauthorizedError } from '@heliosjs/core/utils';
import { ErrorCode } from '@heliosjs/core/types';
import { ValidationError } from 'class-validator';

describe('serializeError', () => {
  describe('HeliosError (code + toResponse)', () => {
    it('serializes BaseError with toResponse()', () => {
      const err = new BaseError(ErrorCode.BAD_REQUEST, 'bad request');
      const serialized = serializeError(err);
      expect(serialized.type).toBe('HttpError');
      expect(serialized.message).toBe('bad request');
      expect(serialized.status).toBe(400);
      expect(serialized.code).toBe(ErrorCode.BAD_REQUEST);
      expect(serialized.original).toBe(err);
    });

    it('serializes UnauthorizedError', () => {
      const err = new UnauthorizedError('no token');
      const serialized = serializeError(err);
      expect(serialized.type).toBe('HttpError');
      expect(serialized.status).toBe(401);
    });
  });

  describe('ValidationError array', () => {
    it('serializes array of class-validator ValidationError', () => {
      const v1 = new ValidationError();
      v1.property = 'email';
      v1.value = 'bad';
      v1.constraints = { isEmail: 'email is invalid' };

      const serialized = serializeError([v1]);
      expect(serialized.type).toBe('ValidationError');
      expect(serialized.status).toBe(400);
      expect(serialized.errors).toBeDefined();
      expect((serialized.errors as any[]).length).toBe(1);
    });
  });

  describe('single ValidationError', () => {
    it('serializes single class-validator ValidationError', () => {
      const v = new ValidationError();
      v.property = 'name';
      v.constraints = { isNotEmpty: 'name should not be empty' };

      const serialized = serializeError(v);
      expect(serialized.type).toBe('ValidationError');
      expect(serialized.status).toBe(400);
      expect(serialized.message).toContain('name');
    });
  });

  describe('AxiosError', () => {
    it('serializes axios-like error', () => {
      const err = {
        isAxiosError: true,
        message: 'Request failed',
        response: { status: 502, statusText: 'Bad Gateway', data: { detail: 'upstream down' } },
        code: 'ERR_BAD_RESPONSE',
        stack: 'ax\nstack',
      };
      const serialized = serializeError(err);
      expect(serialized.type).toBe('AxiosError');
      expect(serialized.status).toBe(502);
      expect(serialized.data).toEqual({ detail: 'upstream down' });
    });

    it('serializes error with response but no isAxiosError', () => {
      const err = { response: { status: 404 }, message: 'not found' };
      const serialized = serializeError(err);
      expect(serialized.type).toBe('AxiosError');
      expect(serialized.status).toBe(404);
    });
  });

  describe('HTTP error object', () => {
    it('serializes object with status', () => {
      const err = { status: 403, message: 'forbidden', code: 'FORBIDDEN', data: { extra: 1 } };
      const serialized = serializeError(err);
      expect(serialized.type).toBe('HttpError');
      expect(serialized.status).toBe(403);
      expect(serialized.data).toEqual({ extra: 1 });
    });

    it('serializes object with statusCode instead of status', () => {
      const err = { statusCode: 500, message: 'oops' };
      const serialized = serializeError(err);
      expect(serialized.type).toBe('HttpError');
      expect(serialized.status).toBe(500);
    });
  });

  describe('native Error', () => {
    it('serializes native Error', () => {
      const err = new TypeError('type mismatch');
      const serialized = serializeError(err);
      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('type mismatch');
      expect(serialized.status).toBe(500);
      expect(serialized.stack).toBeDefined();
    });
  });

  describe('string error', () => {
    it('serializes string', () => {
      const serialized = serializeError('something went wrong');
      expect(serialized.type).toBe('Unknown');
      expect(serialized.message).toBe('something went wrong');
      expect(serialized.status).toBe(500);
    });
  });

  describe('unknown error', () => {
    it('serializes null as unknown', () => {
      const serialized = serializeError(null);
      expect(serialized.type).toBe('Unknown');
      expect(serialized.status).toBe(500);
    });

    it('serializes number as unknown', () => {
      const serialized = serializeError(42);
      expect(serialized.type).toBe('Unknown');
      expect(serialized.status).toBe(500);
    });
  });
});

describe('isError', () => {
  it('returns false for null and undefined', () => {
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });

  it('returns true for HeliosError (code + toResponse)', () => {
    expect(isError(new BaseError(ErrorCode.BAD_REQUEST, 'x'))).toBe(true);
  });

  it('returns true for native Error', () => {
    expect(isError(new Error('x'))).toBe(true);
    expect(isError(new TypeError('x'))).toBe(true);
  });

  it('returns true for object with status', () => {
    expect(isError({ status: 400 })).toBe(true);
  });

  it('returns true for object with statusCode', () => {
    expect(isError({ statusCode: 500 })).toBe(true);
  });

  it('returns true for object with message string', () => {
    expect(isError({ message: 'fail' })).toBe(true);
  });

  it('returns true for object with code', () => {
    expect(isError({ code: 'ERR' })).toBe(true);
  });

  it('returns true for object with response', () => {
    expect(isError({ response: {} })).toBe(true);
  });

  it('returns true for axios-like error', () => {
    expect(isError({ isAxiosError: true })).toBe(true);
  });

  it('returns true for object with Error-like name', () => {
    expect(isError({ name: 'TypeError' })).toBe(true);
    expect(isError({ name: 'RangeError' })).toBe(true);
    expect(isError({ name: 'SyntaxError' })).toBe(true);
  });

  it('returns true for non-empty string', () => {
    expect(isError('fail')).toBe(true);
  });

  it('returns true for number', () => {
    expect(isError(42)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isError('')).toBe(false);
  });

  it('returns false for plain object without error indicators', () => {
    expect(isError({ foo: 'bar' })).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isError({})).toBe(false);
  });
});

describe('getErrorType', () => {
  it('returns isError=false for null/undefined', () => {
    expect(getErrorType(null)).toEqual({ isError: false, type: null, confidence: 'high' });
    expect(getErrorType(undefined)).toEqual({ isError: false, type: null, confidence: 'high' });
  });

  it('detects HeliosError', () => {
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'x');
    const result = getErrorType(err);
    expect(result.isError).toBe(true);
    expect(result.type).toBe('HeliosError');
    expect(result.confidence).toBe('high');
  });

  it('detects ValidationError from class-validator', () => {
    const v = new ValidationError();
    v.property = 'name';
    const result = getErrorType(v);
    expect(result.isError).toBe(true);
    expect(result.type).toBe('ValidationError');
  });

  it('detects array of ValidationErrors', () => {
    const v = new ValidationError();
    v.property = 'name';
    const result = getErrorType([v]);
    expect(result.isError).toBe(true);
    expect(result.type).toBe('ValidationError');
  });

  it('detects native Error', () => {
    const result = getErrorType(new Error('x'));
    expect(result.isError).toBe(true);
    expect(result.type).toBe('Error');
  });

  it('detects AxiosError', () => {
    const result = getErrorType({ isAxiosError: true, message: 'fail' });
    expect(result.isError).toBe(true);
    expect(result.type).toBe('AxiosError');
  });

  it('detects error with response property', () => {
    const result = getErrorType({ response: { status: 500 } });
    expect(result.isError).toBe(true);
    expect(result.type).toBe('AxiosError');
  });

  it('unwraps .data / .error / .err wrappers', () => {
    const inner = new Error('inner');
    expect(getErrorType({ data: inner }).type).toBe('Error');
    expect(getErrorType({ error: inner }).type).toBe('Error');
    expect(getErrorType({ err: inner }).type).toBe('Error');
  });

  it('returns isError=false for non-error objects', () => {
    expect(getErrorType({ foo: 'bar' }).isError).toBe(false);
  });
});
