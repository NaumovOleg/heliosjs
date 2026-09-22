import type { MiddlewareCB } from '@heliosjs/core/types';
import { PluginDispatch } from '@heliosjs/core/utils';
import type { Plugin as HttpPlugin } from '../../types/http';

/**
 * `@heliosjs/http`'s plugin dispatcher — see `PluginDispatch` in
 * `@heliosjs/core` for the shared register/dispatch logic this builds on.
 * The one thing http needs beyond that base: a plugin's `middleware` (if
 * present) is prepended to the global middleware chain on registration.
 */
export class Plugin extends PluginDispatch<HttpPlugin> {
  middlewares: MiddlewareCB[] = [];

  /**
   * Registers a plugin and attaches its middleware/hook lifecycle.
   *
   * @param plugin - Plugin instance implementing Helios HTTP plugin hooks.
   * @returns Current host instance for fluent chaining.
   *
   * @example
   * app.usePlugin({
   *   name: 'logger',
   *   hooks: {
   *     beforeRoute: async (req) => console.log(req.path),
   *   },
   * });
   */
  usePlugin(plugin: HttpPlugin): this {
    super.usePlugin(plugin);
    if (plugin.middleware) {
      this.middlewares.unshift(plugin.middleware);
    }
    return this;
  }
}
