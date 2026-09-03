import { describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../../src/http/src/utils/http/plugin';

describe('Plugin', () => {
  it('registers a plugin and calls onInit', () => {
    const plugin = { name: 'test', onInit: vi.fn() };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.plugins).toContain(plugin);
    expect(plugin.onInit).toHaveBeenCalledWith(host);
  });

  it('prepends plugin middleware to middlewares array', () => {
    const mw = () => {};
    const plugin = { name: 'test', middleware: mw };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.middlewares).toContain(mw);
    expect(host.middlewares[0]).toBe(mw);
  });

  it('returns this for chaining', () => {
    const plugin = { name: 'test' };
    const host = new Plugin();
    const result = host.usePlugin(plugin);
    expect(result).toBe(host);
  });

  it('does not add middleware if plugin has none', () => {
    const plugin = { name: 'test' };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.middlewares).toEqual([]);
  });

  it('callPluginHook calls matching hooks on plugins', async () => {
    const hook = vi.fn();
    const plugin = { name: 'test', hooks: { beforeRequest: hook } };
    const host = new Plugin();
    host.usePlugin(plugin);
    // callPluginHook is protected, test via subclass
    class TestHost extends Plugin {
      async callHook(name: string, ...args: any[]) {
        return (this as any).callPluginHook(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    await h.callHook('beforeRequest', 'arg1', 'arg2');
    expect(hook).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('callPluginHook catches errors', async () => {
    const hook = vi.fn().mockRejectedValue(new Error('hook failed'));
    const plugin = { name: 'test', hooks: { beforeRequest: hook } };
    class TestHost extends Plugin {
      async callHook(name: string, ...args: any[]) {
        return (this as any).callPluginHook(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    // Should not throw
    await h.callHook('beforeRequest', 'arg1');
    expect(hook).toHaveBeenCalled();
  });

  it('callPluginMethod calls matching methods on plugins', async () => {
    const onStart = vi.fn();
    const plugin = { name: 'test', onStart };
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    await h.callMethod('onStart', 'server');
    expect(onStart).toHaveBeenCalledWith('server');
  });

  it('callPluginMethod catches errors', async () => {
    const onStart = vi.fn().mockRejectedValue(new Error('fail'));
    const plugin = { name: 'test', onStart };
    class TestHost extends Plugin {
      async callMethod(name: string, ...args: any[]) {
        return (this as any).callPluginMethod(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    await h.callMethod('onStart');
    expect(onStart).toHaveBeenCalled();
  });

  it('skips plugins without matching hook', async () => {
    const plugin = { name: 'test' };
    class TestHost extends Plugin {
      async callHook(name: string, ...args: any[]) {
        return (this as any).callPluginHook(name, ...args);
      }
    }
    const h = new TestHost();
    h.usePlugin(plugin);
    // Should not throw
    await h.callHook('beforeRequest');
  });
});
