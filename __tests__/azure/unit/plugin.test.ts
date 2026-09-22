import { describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../../src/azure/src/utils/azure/plugin';

describe('Azure Plugin', () => {
  it('registers plugin and calls onInit', () => {
    const onInit = vi.fn();
    const plugin = { name: 'test', onInit };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.plugins).toContain(plugin);
    expect(onInit).toHaveBeenCalledWith(host);
  });

  it('returns this for chaining', () => {
    const host = new Plugin();
    expect(host.usePlugin({ name: 'test' })).toBe(host);
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
    await h.callHook('beforeRequest', 'req', 'ctx');
    expect(hook).toHaveBeenCalledWith('req', 'ctx');
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
    // Azure plugins only really have `onInit` — `onStart` here is a
    // deliberately-arbitrary method name, to prove callPluginMethod
    // dispatches on any key present on the plugin object, not just the
    // real Plugin interface's own fields. `as any` on the object literal
    // is intentional: this is testing generic dispatch, not the typed
    // public surface (a real caller can't pass `onStart` — AzurePlugin
    // doesn't declare it, and usePlugin's parameter is typed).
    const onStart = vi.fn();
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test', onStart } as any);
    await h.callMethod('onStart', 'event');
    expect(onStart).toHaveBeenCalledWith('event');
  });

  it('callPluginMethod skips plugins that do not implement the method', async () => {
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test' });
    await expect(h.callMethod('onStart', 'event')).resolves.toBeUndefined();
  });

  it('callPluginMethod catches errors', async () => {
    const onStart = vi.fn().mockRejectedValue(new Error('err'));
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin({ name: 'test', onStart } as any);
    await h.callMethod('onStart');
    expect(onStart).toHaveBeenCalled();
  });
});
