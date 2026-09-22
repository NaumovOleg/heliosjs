import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { computeFingerprint, getOrComputeFingerprint, setFingerprintConfig } from '../../../src/core/src/utils/core/fingerprint';
import { validate } from '../../../src/core/src/utils/shared/validate';
import { ApplicationError } from '../../../src/core/src/utils/core/error/apperror';

function makeMeta(overrides: Record<string, any> = {}) {
  return { requestId: 'r1', method: 'GET', requestUrl: new URL('http://localhost/test'), sourceIp: '127.0.0.1', userAgent: 'test', startTime: Date.now(), ...overrides };
}

describe('fingerprint.ts - acceptEncoding extractor', () => {
  it('computes fingerprint with acceptEncoding component', () => {
    setFingerprintConfig({ components: ['ip', 'userAgent', 'acceptLanguage', 'acceptEncoding'] });
    const req = {
      sourceIp: '127.0.0.1', userAgent: 'test',
      getClientIp: () => '127.0.0.1',
      getHeader: vi.fn().mockImplementation((name: string) => {
        if (name === 'accept-language') return 'en-US';
        if (name === 'accept-encoding') return 'gzip, deflate';
        return undefined;
      }),
    } as any;
    const fp = computeFingerprint(req);
    expect(fp).toBeTruthy();
    expect(typeof fp).toBe('string');
  });

  it('computes fingerprint with secret (hmac)', () => {
    setFingerprintConfig({ secret: 'my-secret' });
    const req = { sourceIp: '127.0.0.1', userAgent: 'test', getClientIp: () => '127.0.0.1', getHeader: vi.fn().mockReturnValue(undefined) } as any;
    const fp = computeFingerprint(req);
    expect(fp).toBeTruthy();
  });

  it('computes fingerprint with custom compute function', () => {
    setFingerprintConfig({ compute: () => 'custom-fp' });
    const req = { sourceIp: '127.0.0.1', userAgent: 'test', getClientIp: () => '127.0.0.1', getHeader: vi.fn().mockReturnValue(undefined) } as any;
    const fp = computeFingerprint(req);
    expect(fp).toBe('custom-fp');
  });

  it('getOrComputeFingerprint caches in state', () => {
    setFingerprintConfig(undefined);
    const state: Record<string, any> = {};
    const req = {
      sourceIp: '127.0.0.1', userAgent: 'test',
      getClientIp: () => '127.0.0.1',
      getHeader: vi.fn().mockReturnValue(undefined),
      getState: vi.fn().mockImplementation((k: string) => state[k]),
      setState: vi.fn().mockImplementation((k: string, v: any) => { state[k] = v; }),
    } as any;
    const fp1 = getOrComputeFingerprint(req);
    const fp2 = getOrComputeFingerprint(req);
    expect(fp1).toBe(fp2);
  });

  it('getOrComputeFingerprint returns existing from state', () => {
    const req = {
      sourceIp: '127.0.0.1', userAgent: 'test',
      getClientIp: () => '127.0.0.1',
      getHeader: vi.fn().mockReturnValue(undefined),
      getState: vi.fn().mockReturnValue('cached-fp'),
      setState: vi.fn(),
    } as any;
    const fp = getOrComputeFingerprint(req);
    expect(fp).toBe('cached-fp');
  });
});

describe('validate.ts - guard paths', () => {
  it('returns data when dtoClass is falsy', async () => {
    const result = await validate(null, { name: 'test' });
    expect(result).toEqual({ name: 'test' });
  });

  it('returns data when dtoClass has from() static method', async () => {
    const dto = { from: vi.fn().mockReturnValue({ transformed: true }) };
    const result = await validate(dto, { name: 'test' });
    expect(result).toEqual({ transformed: true });
    expect(dto.from).toHaveBeenCalledWith({ name: 'test' });
  });

  it('returns data when dtoClass is not a function', async () => {
    const result = await validate('not-a-function', { name: 'test' });
    expect(result).toEqual({ name: 'test' });
  });
});

describe('apperror.ts - normalizeError paths', () => {
  it('ApplicationError with plain Error', () => {
    const err = new ApplicationError(new Error('test'), {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(err).toBeDefined();
    expect(err.status).toBe(500);
  });

  it('ApplicationError with error that has status=401', () => {
    const err = new Error('unauth');
    (err as any).status = 401;
    const appErr = new ApplicationError(err, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(401);
  });

  it('ApplicationError with error that has statusCode=404', () => {
    const err = new Error('not found');
    (err as any).statusCode = 404;
    const appErr = new ApplicationError(err, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(404);
  });

  it('ApplicationError with axios error', () => {
    const err = new Error('axios fail');
    (err as any).isAxiosError = true;
    (err as any).response = { status: 502, data: { message: 'bad gateway' } };
    const appErr = new ApplicationError(err, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(502);
  });

  it('ApplicationError with string error', () => {
    const appErr = new ApplicationError('string error' as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(500);
  });

  it('ApplicationError with plain object error', () => {
    const appErr = new ApplicationError({ message: 'obj err', status: 422 } as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(422);
  });

  it('ApplicationError with unknown type falls through', () => {
    const appErr = new ApplicationError(12345 as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(500);
  });

  it('ApplicationError with cause stack', () => {
    const cause = new Error('cause');
    const err = new Error('test');
    (err as any).cause = cause;
    const appErr = new ApplicationError(err, {
      meta: makeMeta() as any,
      config: { includeStack: true, logErrors: false },
    });
    expect(appErr.stack).toBeDefined();
  });

  it('ApplicationError logs error when config.logErrors is true', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    new ApplicationError(new Error('test'), {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: true },
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('ApplicationError logs 4xx as warn', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = { message: 'client err', status: 400 };
    new ApplicationError(err as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: true },
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('ApplicationError with validation error object (hits formatValidationErrors)', () => {
    const err = {
      status: 400,
      message: 'Validation failed',
      errors: [
        { property: 'email', value: 'bad', constraints: { isEmail: 'invalid email' }, children: [] },
      ],
    };
    const appErr = new ApplicationError(err as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(400);
  });

  it('ApplicationError with nested validation errors', () => {
    const err = {
      status: 400,
      message: 'Validation failed',
      errors: [
        {
          property: 'address', value: {}, constraints: {},
          children: [{ property: 'city', value: '', constraints: { isNotEmpty: 'empty' }, children: [] }],
        },
      ],
    };
    const appErr = new ApplicationError(err as any, {
      meta: makeMeta() as any,
      config: { includeStack: false, logErrors: false },
    });
    expect(appErr.status).toBe(400);
  });
});
