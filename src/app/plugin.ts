import { MiddlewareCB, PluginHookKeys, PluginKeys } from '@types';

export class Plugin {
  plugins: any[];
  middlewares: MiddlewareCB[];
  protected async callPluginHook<K extends PluginHookKeys>(
    hookName: K,
    ...args: any
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
  protected async callPluginMethod<K extends PluginKeys>(
    hookName: PluginKeys,
    ...args: any
  ): Promise<void> {
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
