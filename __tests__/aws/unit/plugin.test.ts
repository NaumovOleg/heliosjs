import { describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../../src/aws/src/utils/aws/plugin';

describe('AWS Plugin', () => {
  it('registers plugin and calls onInit', () => {
    const onInit = vi.fn();
    const plugin = { name: 'test', onInit };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.plugins).toContain(plugin);
    expect(onInit).toHaveBeenCalledWith(host);
  });

  it('logs and does not throw when onInit rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onInit = vi.fn().mockRejectedValue(new Error('init failed'));
    const host = new Plugin();
    expect(() => host.usePlugin({ name: 'test', onInit })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('has no middleware-chain concept, unlike @heliosjs/http — a `middleware` field is simply not read', () => {
    // AWS/Lambda has no global middleware chain anywhere in lambda.ts. A
    // previous version of this class collected `plugin.middleware` into a
    // `middlewares` array that nothing ever consumed — dead code (removed;
    // see the commit that fixed it) that these two tests used to assert on,
    // which is exactly how it went unnoticed. This documents the actual
    // behavior instead of the never-executed one.
    const mw = async () => {};
    const host = new Plugin();
    expect(() => host.usePlugin({ name: 'test', middleware: mw } as any)).not.toThrow();
    expect((host as unknown as { middlewares?: unknown[] }).middlewares).toBeUndefined();
  });

  it('returns this for chaining', () => {
    const host = new Plugin();
    expect(host.usePlugin({ name: 'test' })).toBe(host);
  });

  it('callPluginHook calls hooks', async () => {
    const hook = vi.fn();
    const plugin = { name: 'test', hooks: { beforeRequest: hook } };
    class TestHost extends Plugin {
      async callHook(name: string, ...args: any[]) {
        return (this as any).callPluginHook(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    await h.callHook('beforeRequest', 'ev', 'ctx');
    expect(hook).toHaveBeenCalledWith('ev', 'ctx');
  });

  it('callPluginHook catches errors', async () => {
    const hook = vi.fn().mockRejectedValue(new Error('fail'));
    class TestHost extends Plugin {
      async callHook(name: string, ...args: any[]) {
        return (this as any).callPluginHook(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test', hooks: { beforeRequest: hook } });
    await h.callHook('beforeRequest');
    expect(hook).toHaveBeenCalled();
  });

  it('callPluginMethod calls methods', async () => {
    const onStart = vi.fn();
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test', onStart });
    await h.callMethod('onStart', 'event');
    expect(onStart).toHaveBeenCalledWith('event');
  });

  it('callPluginMethod catches errors', async () => {
    const onStart = vi.fn().mockRejectedValue(new Error('err'));
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test', onStart });
    await h.callMethod('onStart');
    expect(onStart).toHaveBeenCalled();
  });
});
