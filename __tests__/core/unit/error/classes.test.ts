import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@heliosjs/core/types';
import {
  BaseError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitExceededError,
  PayloadTooLargeError,
  InternalServerError,
  InvalidStateError,
  DuplicateEntryError,
  DependencyFailedError,
  ServiceUnavailableError,
} from '@heliosjs/core/utils';

describe('BaseError', () => {
  it('sets code, status, message from constructor', () => {
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'bad request');
    expect(err.code).toBe(ErrorCode.BAD_REQUEST);
    expect(err.status).toBe(400);
    expect(err.message).toBe('bad request');
    expect(err.name).toBe('HeliosError');
  });

  it('defaults status based on ErrorCode', () => {
    expect(new BaseError(ErrorCode.UNAUTHORIZED, 'x').status).toBe(401);
    expect(new BaseError(ErrorCode.FORBIDDEN, 'x').status).toBe(403);
    expect(new BaseError(ErrorCode.NOT_FOUND, 'x').status).toBe(404);
    expect(new BaseError(ErrorCode.VALIDATION_FAILED, 'x').status).toBe(400);
    expect(new BaseError(ErrorCode.RATE_LIMIT_EXCEEDED, 'x').status).toBe(429);
    expect(new BaseError(ErrorCode.PAYLOAD_TOO_LARGE, 'x').status).toBe(413);
    expect(new BaseError(ErrorCode.INTERNAL_SERVER_ERROR, 'x').status).toBe(500);
    expect(new BaseError(ErrorCode.DATABASE_ERROR, 'x').status).toBe(500);
  });

  it('allows overriding status', () => {
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'x', { status: 422 });
    expect(err.status).toBe(422);
  });

  it('stores details, requestId, path, method, upstream', () => {
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'x', {
      details: [{ field: 'name', value: undefined }],
      requestId: 'req-1',
      path: '/users',
      method: 'POST',
      upstream: { extra: 'data' },
    });
    expect(err.details).toEqual([{ field: 'name', value: undefined }]);
    expect(err.requestId).toBe('req-1');
    expect(err.path).toBe('/users');
    expect(err.method).toBe('POST');
    expect(err.upstream).toEqual({ extra: 'data' });
  });

  it('stores cause as ErrorObject', () => {
    const cause = new Error('root cause');
    const err = new BaseError(ErrorCode.INTERNAL_SERVER_ERROR, 'x', { cause });
    expect(err.cause).toBe(cause);
  });

  it('has a timestamp', () => {
    const before = Date.now();
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'x');
    expect(err.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('toResponse() returns structured ErrorResponse', () => {
    const err = new BaseError(ErrorCode.NOT_FOUND, 'not found', {
      requestId: 'r-1',
      path: '/items/1',
    });
    const res = err.toResponse();
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(ErrorCode.NOT_FOUND);
    expect(res.error.status).toBe(404);
    expect(res.error.message).toBe('not found');
    expect(res.error.requestId).toBe('r-1');
    expect(res.error.path).toBe('/items/1');
    expect(res.error.timestamp).toBeDefined();
  });

  it('captures stack trace', () => {
    const err = new BaseError(ErrorCode.BAD_REQUEST, 'x');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('HeliosError');
  });
});

describe('UnauthorizedError', () => {
  it('defaults to 401 and message "Unauthorized"', () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('UnauthorizedError');
  });

  it('accepts custom message and options', () => {
    const err = new UnauthorizedError('Token expired', { requestId: 'r-1', path: '/auth' });
    expect(err.message).toBe('Token expired');
    expect(err.requestId).toBe('r-1');
    expect(err.path).toBe('/auth');
  });
});

describe('ForbiddenError', () => {
  it('defaults to 403 and message "Forbidden"', () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
    expect(err.message).toBe('Forbidden');
    expect(err.name).toBe('ForbiddenError');
  });

  it('accepts custom message and options', () => {
    const err = new ForbiddenError('No access', { requestId: 'r-1', path: '/admin' });
    expect(err.message).toBe('No access');
    expect(err.requestId).toBe('r-1');
  });
});

describe('NotFoundError', () => {
  it('formats message as "{resource} with id {id} not found"', () => {
    const err = new NotFoundError('User', '123');
    expect(err.status).toBe(404);
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
    expect(err.message).toBe('User with id 123 not found');
    expect(err.name).toBe('NotFoundError');
    expect(err.details).toEqual([{ resource: 'User', id: '123' }]);
  });

  it('accepts options', () => {
    const err = new NotFoundError('Post', '42', { requestId: 'r-1', path: '/posts/42' });
    expect(err.requestId).toBe('r-1');
    expect(err.path).toBe('/posts/42');
  });
});

describe('ValidationError', () => {
  it('defaults to 400 with code VALIDATION_FAILED', () => {
    const details = [{ field: 'email', value: 'bad' }];
    const err = new ValidationError(details);
    expect(err.status).toBe(400);
    expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(err.message).toBe('Validation failed');
    expect(err.name).toBe('ValidationError');
    expect(err.details).toEqual(details);
  });

  it('accepts options', () => {
    const err = new ValidationError([], { requestId: 'r-1', path: '/register' });
    expect(err.requestId).toBe('r-1');
  });
});

describe('RateLimitExceededError', () => {
  it('defaults to 429', () => {
    const err = new RateLimitExceededError();
    expect(err.status).toBe(429);
    expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.name).toBe('RateLimitExceededError');
  });

  it('accepts custom message', () => {
    const err = new RateLimitExceededError('Too many requests');
    expect(err.message).toBe('Too many requests');
  });
});

describe('PayloadTooLargeError', () => {
  it('defaults to 413', () => {
    const err = new PayloadTooLargeError();
    expect(err.status).toBe(413);
    expect(err.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
    expect(err.message).toBe('Payload too large');
    expect(err.name).toBe('PayloadTooLargeError');
  });
});

describe('InternalServerError', () => {
  it('defaults to 500 with details', () => {
    const err = new InternalServerError('DB', 'connection');
    expect(err.status).toBe(500);
    expect(err.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(err.message).toBe('DB');
    expect(err.name).toBe('InternalServerError');
    expect(err.details).toEqual([{ resource: 'DB', id: 'connection' }]);
  });
});

describe('InvalidStateError', () => {
  it('defaults to 409', () => {
    const err = new InvalidStateError();
    expect(err.status).toBe(409);
    expect(err.code).toBe(ErrorCode.INVALID_STATE);
    expect(err.message).toBe('Invalid state');
    expect(err.name).toBe('InvalidStateError');
  });
});

describe('DuplicateEntryError', () => {
  it('defaults to 409', () => {
    const err = new DuplicateEntryError();
    expect(err.status).toBe(409);
    expect(err.code).toBe(ErrorCode.DUPLICATE_ENTRY);
    expect(err.message).toBe('Duplicate entry');
    expect(err.name).toBe('DuplicateEntryError');
  });
});

describe('DependencyFailedError', () => {
  it('defaults to 424', () => {
    const err = new DependencyFailedError();
    expect(err.status).toBe(424);
    expect(err.code).toBe(ErrorCode.DEPENDENCY_FAILED);
    expect(err.message).toBe('Dependency failed');
    expect(err.name).toBe('DependencyFailedError');
  });
});

describe('ServiceUnavailableError', () => {
  it('defaults to 503', () => {
    const err = new ServiceUnavailableError();
    expect(err.status).toBe(503);
    expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(err.message).toBe('Service unavailable');
    expect(err.name).toBe('ServiceUnavailableError');
  });
});

describe('All error classes are instanceof BaseError', () => {
  const errorClasses = [
    new UnauthorizedError(),
    new ForbiddenError(),
    new NotFoundError('X', '1'),
    new ValidationError([]),
    new RateLimitExceededError(),
    new PayloadTooLargeError(),
    new InternalServerError('X', '1'),
    new InvalidStateError(),
    new DuplicateEntryError(),
    new DependencyFailedError(),
    new ServiceUnavailableError(),
  ];

  for (const err of errorClasses) {
    it(`${err.name} extends BaseError`, () => {
      expect(err).toBeInstanceOf(BaseError);
      expect(err).toBeInstanceOf(Error);
    });
  }
});

describe('All error classes implement toResponse()', () => {
  const errors = [
    new UnauthorizedError(),
    new ForbiddenError(),
    new NotFoundError('X', '1'),
    new ValidationError([]),
    new RateLimitExceededError(),
    new PayloadTooLargeError(),
    new InternalServerError('X', '1'),
    new InvalidStateError(),
    new DuplicateEntryError(),
    new DependencyFailedError(),
    new ServiceUnavailableError(),
  ];

  for (const err of errors) {
    it(`${err.name}.toResponse() returns valid ErrorResponse`, () => {
      const res = err.toResponse();
      expect(res.success).toBe(false);
      expect(res.error.code).toBeDefined();
      expect(res.error.status).toBeGreaterThan(0);
      expect(res.error.message).toBeDefined();
      expect(res.error.timestamp).toBeDefined();
    });
  }
});
