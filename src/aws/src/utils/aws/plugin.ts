import type { MiddlewareCB } from '@heliosjs/core/types';
import type { Hooks, PluginHookKeys, PluginKeys, Plugin as TPlugin } from '../../types/aws';
import { getGlobalLogger } from '@heliosjs/core/utils';

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
   * Registers a Lambda plugin and executes its initialization hook.
   *
   * @param plugin - Plugin object implementing Lambda lifecycle hooks.
   * @returns Current adapter instance for fluent chaining.
   *
   * @example
   * app.usePlugin({
   *   name: 'metrics',
   *   hooks: {
   *     beforeRequest: async (event) => console.log(event.requestContext),
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
