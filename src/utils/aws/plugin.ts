import { Hooks, PluginHookKeys, PluginKeys, Plugin as TPlugin } from '../../types/aws';
import { MiddlewareCB } from '../../types/core';

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

  usePlugin(plugin: any) {
    this.plugins.push(plugin);
    plugin.onInit?.(this);
    if (plugin.middleware) {
      this.middlewares?.unshift(plugin.middleware);
    }

    return this;
  }
}
