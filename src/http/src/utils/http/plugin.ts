/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MiddlewareCB } from '@heliosjs/core/types';
import type {
  Plugin as HttpPlugin,
  HttpPluginHooks,
  PluginHookKeys,
  PluginKeys,
} from '../../types/http';

export class Plugin {
  plugins: HttpPlugin[] = [];
  middlewares: MiddlewareCB[] = [];
  protected async callPluginHook<K extends PluginHookKeys>(
    hookName: K,
    ...args: Parameters<NonNullable<HttpPluginHooks[K]>>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        try {
          await (hook as any)(...args);
        } catch (error) {
          console.error(`Plugin ${plugin.name} hook ${hookName} error:`, error);
        }
      }
    }
  }
  protected async callPluginMethod(hookName: PluginKeys, ...args: any): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin?.[hookName];
      if (hook) {
        try {
          await (hook as any)(...args);
        } catch (error) {
          console.error(`Plugin ${plugin.name} hook ${hookName} error:`, error);
        }
      }
    }
  }

  /**
   * Registers a plugin and attaches its middleware/hook lifecycle.
   *
   * @param plugin - Plugin instance implementing Helios HTTP plugin hooks.
   * @returns Current host instance for fluent chaining.
   *
   * @example
   * ```ts
   * app.usePlugin({
   *   name: 'logger',
   *   hooks: {
   *     beforeRoute: async (req) => console.log(req.path),
   *   },
   * });
   * ```
   */
  usePlugin(plugin: any) {
    this.plugins.push(plugin);
    plugin.onInit?.(this);
    if (plugin.middleware) {
      this.middlewares?.unshift(plugin.middleware);
    }

    return this;
  }
}
