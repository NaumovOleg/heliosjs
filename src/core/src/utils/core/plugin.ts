/* eslint-disable @typescript-eslint/no-explicit-any */
import { getGlobalLogger } from './logger';

/**
 * @internal Shared plugin registration/dispatch logic. Each adapter
 * (`@heliosjs/http`, `@heliosjs/aws`, `@heliosjs/azure`) has its own concrete
 * `Plugin`/`Hooks` types — a `beforeRequest` hook's raw-request shape is
 * genuinely different per transport (`IncomingMessage` vs Lambda
 * event+context vs Azure `HttpRequest`+`InvocationContext`), so those stay
 * adapter-specific. What doesn't need three copies is the dispatch itself:
 * register a plugin, run its per-request hooks, run its lifecycle methods,
 * log-and-swallow a failing plugin instead of taking the request/app down.
 * That logic used to be copy-pasted three times with no shared source of
 * truth — which is exactly how it drifted: AWS's copy carried a
 * `middlewares`/`plugin.middleware` handling path that `lambda.ts` never
 * executed (there is no middleware-chain concept in `@heliosjs/aws` at all),
 * dead code nobody noticed because nothing forced the three copies to agree.
 *
 * App code never uses this directly — each adapter's own `Plugin` subclass
 * (`app.usePlugin(...)`) is the public surface; see `@heliosjs/http`'s,
 * `@heliosjs/aws`'s, and `@heliosjs/azure`'s own `Plugin` for that.
 *
 * @typeParam TPlugin - The adapter's own concrete `Plugin` interface.
 * @typeParam THooks - The adapter's own concrete `Hooks` interface, derived
 *   from `TPlugin['hooks']` by default.
 */
export class PluginDispatch<
  TPlugin extends { name: string; hooks?: unknown },
  THooks = NonNullable<TPlugin['hooks']>,
> {
  plugins: TPlugin[] = [];

  /** Runs `hookName` on every registered plugin's `hooks` object, in order. */
  protected async callPluginHook<K extends keyof THooks>(
    hookName: K,
    ...args: any[]
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = (plugin.hooks as any)?.[hookName];
      if (hook) {
        try {
          await hook(...args);
        } catch (error) {
          getGlobalLogger().error(`plugin ${plugin.name}: hook ${String(hookName)} failed`, error);
        }
      }
    }
  }

  /** Runs `hookName` as a method on every registered plugin itself (e.g. `onInit`). */
  protected async callPluginMethod(hookName: keyof TPlugin, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = (plugin as any)?.[hookName];
      if (hook) {
        try {
          await hook(...args);
        } catch (error) {
          getGlobalLogger().error(`plugin ${plugin.name}: hook ${String(hookName)} failed`, error);
        }
      }
    }
  }

  /**
   * Registers a plugin and runs its `onInit` (if present), swallowing and
   * logging a failure — sync or async — so one bad plugin doesn't take
   * registration down. `this` passed to `onInit` is the real adapter
   * instance (`Helios`, etc.) regardless of which class in the chain this
   * method is defined on. `onInit` itself runs as a real method call
   * (`onInit.call(plugin, this)`, not a bare function call), so a plugin
   * that does `onInit(app) { this.client = ... }` sees `this === plugin`,
   * same as calling `plugin.onInit(this)` directly would. Adapters that
   * need more (http also prepends `plugin.middleware` to its global
   * middleware chain) override this and call `super.usePlugin(...)`.
   */
  usePlugin(plugin: TPlugin): this {
    this.plugins.push(plugin);
    const onInit = (plugin as any).onInit;
    if (onInit) {
      try {
        void Promise.resolve(onInit.call(plugin, this)).catch((error: unknown) => {
          getGlobalLogger().error(`plugin ${plugin.name}: onInit failed`, error);
        });
      } catch (error) {
        // onInit threw synchronously, before Promise.resolve ever got a
        // chance to wrap it — catch that path too, not just a rejection.
        getGlobalLogger().error(`plugin ${plugin.name}: onInit failed`, error);
      }
    }
    return this;
  }
}
