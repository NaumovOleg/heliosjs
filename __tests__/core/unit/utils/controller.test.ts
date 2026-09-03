import { describe, expect, it } from 'vitest';
import { NextFunction, getAllMethods, runGuard } from '../../../../src/core/src/utils/core/controller';
import { ForbiddenError } from '../../../../src/core/src/utils/core/error';

describe('NextFunction', () => {
  it('does nothing when called without error', () => {
    expect(() => NextFunction()).not.toThrow();
  });

  it('throws when called with an error', () => {
    const err = new Error('test');
    expect(() => NextFunction(err)).toThrow(err);
  });
});

describe('getAllMethods', () => {
  it('returns own methods', () => {
    class A {
      foo() {}
      bar() {}
    }
    const methods = getAllMethods(new A());
    expect(methods).toContain('foo');
    expect(methods).toContain('bar');
  });

  it('returns inherited methods', () => {
    class Base {
      baseMethod() {}
    }
    class Child extends Base {
      childMethod() {}
    }
    const methods = getAllMethods(new Child());
    expect(methods).toContain('baseMethod');
    expect(methods).toContain('childMethod');
  });

  it('excludes constructor', () => {
    class A {
      foo() {}
    }
    const methods = getAllMethods(new A());
    expect(methods).not.toContain('constructor');
  });

  it('excludes non-function properties', () => {
    class A {
      foo() {}
      bar = 42;
    }
    const methods = getAllMethods(new A());
    expect(methods).not.toContain('bar');
  });

  it('stops at Object.prototype', () => {
    const methods = getAllMethods({});
    expect(methods).toEqual([]);
  });
});

describe('runGuard', () => {
  it('allows guard instance that returns true', async () => {
    const guard = { canActivate: async () => true };
    const req = {} as any;
    const res = {} as any;
    await expect(runGuard(guard, req, res)).resolves.not.toThrow();
  });

  it('throws ForbiddenError when guard instance returns false', async () => {
    const guard = { canActivate: async () => false, message: 'Nope' };
    await expect(runGuard(guard, {} as any, {} as any)).rejects.toThrow(ForbiddenError);
  });

  it('allows guard class that returns true', async () => {
    class Guard {
      async canActivate() { return true; }
    }
    await expect(runGuard(Guard, {} as any, {} as any)).resolves.not.toThrow();
  });

  it('throws ForbiddenError when guard class returns false', async () => {
    class Guard {
      message = 'Denied';
      async canActivate() { return false; }
    }
    await expect(runGuard(Guard, {} as any, {} as any)).rejects.toThrow('Denied');
  });

  it('allows guard function that returns true', async () => {
    const guard = async () => true;
    await expect(runGuard(guard, {} as any, {} as any)).resolves.not.toThrow();
  });

  it('throws ForbiddenError when guard function returns false', async () => {
    const guard = async () => 'Not allowed';
    await expect(runGuard(guard, {} as any, {} as any)).rejects.toThrow('Not allowed');
  });

  it('treats guard function returning string as denial', async () => {
    const guard = async () => 'custom message';
    await expect(runGuard(guard, {} as any, {} as any)).rejects.toThrow('custom message');
  });

  it('uses default message for guard instance without message', async () => {
    const guard = { canActivate: async () => false };
    await expect(runGuard(guard, {} as any, {} as any)).rejects.toThrow('Forbidden');
  });

  it('uses default message for guard class without message', async () => {
    class Guard {
      async canActivate() { return false; }
    }
    await expect(runGuard(Guard, {} as any, {} as any)).rejects.toThrow('Forbidden');
  });
});
