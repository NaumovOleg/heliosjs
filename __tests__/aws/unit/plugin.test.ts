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

  it('prepends middleware', () => {
    const mw = async () => {};
    const plugin = { name: 'test', middleware: mw };
    const host = new Plugin();
    host.usePlugin(plugin);
    expect(host.middlewares[0]).toBe(mw);
  });

  it('returns this for chaining', () => {
    const host = new Plugin();
    expect(host.usePlugin({ name: 'test' })).toBe(host);
  });

  it('skips plugins without middleware', () => {
    const host = new Plugin();
    host.usePlugin({ name: 'test' });
    expect(host.middlewares).toEqual([]);
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
