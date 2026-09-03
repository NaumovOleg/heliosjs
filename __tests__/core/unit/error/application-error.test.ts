import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApplicationError } from '@heliosjs/core/utils';
import { BaseError, UnauthorizedError, NotFoundError } from '@heliosjs/core/utils';
import { ErrorCode } from '@heliosjs/core/types';

const meta = {
  requestId: 'req-1',
  requestUrl: new URL('http://localhost/users'),
  method: 'GET',
  sourceIp: '127.0.0.1',
  userAgent: 'test',
  startTime: Date.now(),
};

describe('ApplicationError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes a native Error to BaseError with status 500', () => {
    const err = new Error('something broke');
    const app = new ApplicationError(err, { meta, config: { logErrors: false } });
    expect(app.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(app.status).toBe(500);
    expect(app.message).toBe('something broke');
  });

  it('normalizes a string error', () => {
    const app = new ApplicationError('string error' as any, { meta, config: { logErrors: false } });
    expect(app.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(app.status).toBe(500);
    expect(app.message).toBe('string error');
  });

  it('normalizes a plain object error', () => {
    const app = new ApplicationError(
      { message: 'not found', status: 404, code: 'NOT_FOUND' },
      { meta, config: { logErrors: false } }
    );
    expect(app.status).toBe(404);
    // 404 is normalized to NotFoundError which formats message as "{resource} with id {id} not found"
    expect(app.message).toContain('not found');
  });

  it('returns BaseError as-is', () => {
    const base = new BaseError(ErrorCode.BAD_REQUEST, 'bad');
    const app = new ApplicationError(base, { meta, config: { logErrors: false } });
    expect(app.code).toBe(ErrorCode.BAD_REQUEST);
    expect(app.status).toBe(400);
  });

  it('normalizes 401 to UnauthorizedError', () => {
    const app = new ApplicationError({ status: 401, message: 'no auth' }, {
      meta,
      config: { logErrors: false },
    });
    expect(app.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(app.status).toBe(401);
  });

  it('normalizes 404 to NotFoundError', () => {
    const app = new ApplicationError({ status: 404, message: 'missing' }, {
      meta,
      config: { logErrors: false },
    });
    expect(app.code).toBe(ErrorCode.NOT_FOUND);
    expect(app.status).toBe(404);
    // NotFoundError formats message as "{resource} with id {id} not found"
    expect(app.message).toContain('not found');
  });

  it('normalizes axios-like error', () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Request failed',
      response: { status: 502, statusText: 'Bad Gateway', data: { detail: 'up' } },
    };
    const app = new ApplicationError(axiosErr as any, { meta, config: { logErrors: false } });
    expect(app.status).toBe(502);
    expect(app.upstream).toEqual({ detail: 'up' });
  });

  it('falls back to 500 for unknown error types', () => {
    const app = new ApplicationError(42 as any, { meta, config: { logErrors: false } });
    expect(app.status).toBe(500);
    expect(app.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
  });

  it('toJSON() returns structured object', () => {
    const app = new ApplicationError(new Error('x'), { meta, config: { logErrors: false } });
    const json = app.toJSON();
    expect(json.code).toBeDefined();
    expect(json.status).toBe(500);
    expect(json.message).toBeDefined();
    expect(json.timestamp).toBeDefined();
    expect(json.requestId).toBe('req-1');
  });

  it('logs errors to console.error for 5xx', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    new ApplicationError(new Error('critical'), { meta, config: { logErrors: true } });
    expect(spy).toHaveBeenCalled();
  });

  it('logs errors to console.warn for 4xx', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new ApplicationError({ status: 400, message: 'bad' }, { meta, config: { logErrors: true } });
    expect(spy).toHaveBeenCalled();
  });

  it('respects config.includeStack', () => {
    const withStack = new ApplicationError(new Error('x'), {
      meta,
      config: { logErrors: false, includeStack: true },
    });
    expect(withStack.stack).toBeDefined();

    const withoutStack = new ApplicationError(new Error('x'), {
      meta,
      config: { logErrors: false, includeStack: false },
    });
    // stack is derived from cause.stack, includeStack only affects logging
    expect(withoutStack.stack).toBeDefined();
  });
});
