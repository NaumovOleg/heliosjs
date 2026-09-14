import type { MiddlewareCB } from '@heliosjs/core/types';
import { getGlobalLogger } from '@heliosjs/core/utils';
import type { Hooks, PluginHookKeys, PluginKeys, Plugin as TPlugin } from '../../types/azure';

export class Plugin {
  plugins: TPlugin[] = [];
  middlewares: MiddlewareCB[] = [];
  protected async callPluginHook<K extends PluginHookKeys>(
    hookName: K,
    ...args: Parameters<NonNullable<Hooks[K]>>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (hook as any)(...args);
        } catch (error) {
          getGlobalLogger().error(`plugin ${plugin.name}: hook ${hookName} failed`, error);
        }
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async callPluginMethod(hookName: PluginKeys, ...args: any): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin?.[hookName];
      if (hook) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (hook as any)(...args);
        } catch (error) {
          getGlobalLogger().error(`plugin ${plugin.name}: hook ${hookName} failed`, error);
        }
      }
    }
  }

  /**
   * Registers an Azure Functions plugin and executes its initialization hook.
   *
   * @param plugin - Plugin object implementing Azure lifecycle hooks.
   * @returns Current adapter instance for fluent chaining.
   *
   * @example
   * app.usePlugin({
   *   name: 'metrics',
   *   hooks: {
   *     beforeRequest: async (req) => console.log(req.url),
   *   },
   * });
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usePlugin(plugin: any) {
    this.plugins.push(plugin);
    plugin.onInit?.(this);
    if (plugin.middleware) {
      this.middlewares?.unshift(plugin.middleware);
    }

    return this;
  }
}
