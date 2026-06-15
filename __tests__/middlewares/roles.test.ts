import { describe, expect, it, afterEach } from 'vitest';
import { matchRoles, normalizeArgs, createRolesGuard, Roles } from '@heliosjs/middlewares';
import { setRolesExtractor, InvalidStateError, reflectMiddlewaresMetadata } from '@heliosjs/core/utils';
import type { Request, GuardFunction } from '@heliosjs/core/types';

describe('matchRoles', () => {
  it('ANY passes when one required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['editor'], 'any')).toBe(true);
  });
  it('ANY fails when no required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['viewer'], 'any')).toBe(false);
  });
  it('ALL passes when every required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['editor', 'admin'], 'all')).toBe(true);
  });
  it('ALL fails when one required role is missing', () => {
    expect(matchRoles(['admin', 'editor'], ['admin'], 'all')).toBe(false);
  });
});

describe('normalizeArgs', () => {
  it('flattens varargs strings, defaults to ANY', () => {
    expect(normalizeArgs(['admin', 'editor'])).toEqual({
      roles: ['admin', 'editor'],
      options: {},
    });
  });
  it('flattens a single array arg', () => {
    expect(normalizeArgs([['admin', 'editor']])).toEqual({
      roles: ['admin', 'editor'],
      options: {},
    });
  });
  it('extracts a trailing options object', () => {
    expect(normalizeArgs([['admin', 'editor'], { mode: 'all' }])).toEqual({
      roles: ['admin', 'editor'],
      options: { mode: 'all' },
    });
  });
  it('extracts options after varargs', () => {
    expect(normalizeArgs(['admin', { message: 'no' }])).toEqual({
      roles: ['admin'],
      options: { message: 'no' },
    });
  });
  it('handles empty args', () => {
    expect(normalizeArgs([])).toEqual({ roles: [], options: {} });
  });
});

const req = {} as Request;

describe('createRolesGuard', () => {
  afterEach(() => setRolesExtractor(undefined));

  it('returns true when extractor roles satisfy ANY', async () => {
    setRolesExtractor(() => ['editor']);
    const guard = createRolesGuard(['admin', 'editor'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('returns the message string when roles do not satisfy', async () => {
    setRolesExtractor(() => ['viewer']);
    const guard = createRolesGuard(['admin'], { message: 'Admins only' });
    await expect(guard(req, {} as never)).resolves.toBe('Admins only');
  });

  it('uses the default message when none provided', async () => {
    setRolesExtractor(() => []);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('normalizes a single string from the extractor', async () => {
    setRolesExtractor(() => 'admin');
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('treats undefined extractor result as no roles', async () => {
    setRolesExtractor(() => undefined);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('awaits an async extractor', async () => {
    setRolesExtractor(async () => ['admin']);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('enforces ALL mode', async () => {
    setRolesExtractor(() => ['admin']);
    const guard = createRolesGuard(['admin', 'editor'], { mode: 'all' });
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('throws InvalidStateError when no extractor is configured', async () => {
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).rejects.toBeInstanceOf(InvalidStateError);
  });
});

describe('Roles decorator', () => {
  it('registers a guard on a controller class', () => {
    class Ctrl {}
    Roles('admin')(Ctrl);

    const meta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].guard).toBe('function');
  });

  it('registers a guard on a method', () => {
    class Ctrl {
      handler() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(Ctrl.prototype, 'handler')!;
    Roles('admin')(Ctrl.prototype, 'handler', descriptor);

    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler') ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].guard).toBe('function');
  });
});

describe('Roles applies globally (controller) and locally (method)', () => {
  afterEach(() => setRolesExtractor(undefined));

  it('controller-level Roles registers an enforcing guard at class scope', async () => {
    class Ctrl {}
    Roles('admin')(Ctrl);

    const meta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(meta.length).toBe(1);
    const guard = meta[0].guard as GuardFunction;

    setRolesExtractor(() => ['admin']);
    await expect(guard({} as Request, {} as never)).resolves.toBe(true);

    setRolesExtractor(() => ['viewer']);
    await expect(guard({} as Request, {} as never)).resolves.toBe('Insufficient role');
  });

  it('method-level Roles registers an enforcing guard only on that method, not the class', async () => {
    class Ctrl {
      handler() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(Ctrl.prototype, 'handler')!;
    Roles('editor')(Ctrl.prototype, 'handler', descriptor);

    // Nothing registered at class scope
    const classMeta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(classMeta.length).toBe(0);

    // Guard registered on the method
    const methodMeta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler') ?? [];
    expect(methodMeta.length).toBe(1);
    const guard = methodMeta[0].guard as GuardFunction;

    setRolesExtractor(() => ['editor']);
    await expect(guard({} as Request, {} as never)).resolves.toBe(true);

    setRolesExtractor(() => ['admin']);
    await expect(guard({} as Request, {} as never)).resolves.toBe('Insufficient role');
  });
});
