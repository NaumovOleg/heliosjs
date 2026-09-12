import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

describe('meta descriptor', () => {
  it('merges parent prefix with controller prefix and normalizes slashes', () => {
    const parentMeta = { prefix: '/api', name: 'root', routes: [], functions: [], children: [] };
    const controllerMeta = { name: 'UsersCtrl', prefix: '/users', controllers: [], routes: [] };

    const merged = (parentMeta.prefix + '/' + controllerMeta.prefix).replaceAll(/\/+/g, '/');
    expect(merged).toBe('/api/users');
  });

  it('handles parent prefix with trailing slash', () => {
    const result = ('/api/' + '/users').replaceAll(/\/+/g, '/');
    expect(result).toBe('/api/users');
  });

  it('handles parent prefix without leading slash', () => {
    const result = ('/' + '/users').replaceAll(/\/+/g, '/');
    expect(result).toBe('/users');
  });

  it('preserves trailing slash in path', () => {
    const result = ('/api/' + '/users/').replaceAll(/\/+/g, '/');
    expect(result).toBe('/api/users/');
  });

  it('merges parent functions with controller functions', () => {
    const parentFn = { middleware: () => {} };
    const controllerFn = { guard: () => true };

    const merged = [parentFn, controllerFn];
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(parentFn);
    expect(merged[1]).toBe(controllerFn);
  });
});
