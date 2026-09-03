import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../../../src/core/src/utils/core/error/authorizations';
import { DependencyFailedError } from '../../../../src/core/src/utils/core/error/dependencyFailed';
import { DuplicateEntryError } from '../../../../src/core/src/utils/core/error/duplicateEntry';
import { InvalidStateError } from '../../../../src/core/src/utils/core/error/invalidState';
import { NotFoundError } from '../../../../src/core/src/utils/core/error/notfound';
import { PayloadTooLargeError } from '../../../../src/core/src/utils/core/error/payloadTooLarge';
import { ServiceUnavailableError } from '../../../../src/core/src/utils/core/error/serviceUnavailable';
import { BaseError } from '../../../../src/core/src/utils/core/error/base';

describe('UnauthorizedError', () => {
  it('creates with default message and status 401', () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('UnauthorizedError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('creates with custom message', () => {
    const err = new UnauthorizedError('Custom auth error');
    expect(err.message).toBe('Custom auth error');
  });

  it('accepts requestId and path options', () => {
    const err = new UnauthorizedError('err', { requestId: 'r1', path: '/api' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('DependencyFailedError', () => {
  it('creates with default message and status 424', () => {
    const err = new DependencyFailedError();
    expect(err.status).toBe(424);
    expect(err.message).toBe('Dependency failed');
    expect(err.name).toBe('DependencyFailedError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new DependencyFailedError('dep failed', { requestId: 'r1', path: '/svc' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('DuplicateEntryError', () => {
  it('creates with default message and status 409', () => {
    const err = new DuplicateEntryError();
    expect(err.status).toBe(409);
    expect(err.message).toBe('Duplicate entry');
    expect(err.name).toBe('DuplicateEntryError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new DuplicateEntryError('dup', { requestId: 'r1', path: '/create' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('InvalidStateError', () => {
  it('creates with default message and status 409', () => {
    const err = new InvalidStateError();
    expect(err.status).toBe(409);
    expect(err.message).toBe('Invalid state');
    expect(err.name).toBe('InvalidStateError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new InvalidStateError('bad state', { requestId: 'r1', path: '/update' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('NotFoundError', () => {
  it('creates with resource and id', () => {
    const err = new NotFoundError('User', '42');
    expect(err.status).toBe(404);
    expect(err.message).toBe('User with id 42 not found');
    expect(err.name).toBe('NotFoundError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new NotFoundError('Order', '99', { requestId: 'r1', path: '/orders' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('PayloadTooLargeError', () => {
  it('creates with default message and status 413', () => {
    const err = new PayloadTooLargeError();
    expect(err.status).toBe(413);
    expect(err.message).toBe('Payload too large');
    expect(err.name).toBe('PayloadTooLargeError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new PayloadTooLargeError('too big', { requestId: 'r1', path: '/upload' });
    expect(err).toBeInstanceOf(BaseError);
  });
});

describe('ServiceUnavailableError', () => {
  it('creates with default message and status 503', () => {
    const err = new ServiceUnavailableError();
    expect(err.status).toBe(503);
    expect(err.message).toBe('Service unavailable');
    expect(err.name).toBe('ServiceUnavailableError');
    expect(err).toBeInstanceOf(BaseError);
  });

  it('accepts requestId and path options', () => {
    const err = new ServiceUnavailableError('down', { requestId: 'r1', path: '/health' });
    expect(err).toBeInstanceOf(BaseError);
  });
});
