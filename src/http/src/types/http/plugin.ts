import type { IncomingMessage, Server } from 'node:http';
import type { MiddlewareCB, Request, Response } from '@heliosjs/core/types';

/** Request-lifecycle hooks an HTTP plugin can implement. All optional. */
export interface HttpPluginHooks {
  /** Runs on the raw Node request before a framework `Request` is built. */
  beforeRequest?: (req: IncomingMessage) => void | Promise<void>;
  /** Runs after CORS/middlewares, just before the controller dispatches. */
  beforeRoute?: (req: Request, response: Response) => void | Promise<void>;
  /** Runs after the response has been sent. */
  afterResponse?: (req: Request, res: Response) => void | Promise<void>;
}

/**
 * A plugin for `@heliosjs/http`. Register with `app.usePlugin(plugin)`.
 * `middleware` (if present) is prepended to the global chain; `hooks` tap the
 * request lifecycle; `onInit` / `onStart` / `onStop` tap the server lifecycle.
 */
export interface Plugin {
  /** Unique plugin name, used in log lines. */
  name: string;

  /** Called synchronously when the plugin is registered. */
  onInit?(server: Server): void | Promise<void>;
  /** Called once the HTTP server is listening. */
  onStart?(server: Server): void | Promise<void>;
  /** Called during graceful shutdown. */
  onStop?(server: Server): void | Promise<void>;
  /** A middleware prepended to the global chain when the plugin is registered. */
  middleware?: MiddlewareCB;

  /** Per-request lifecycle hooks. */
  hooks?: HttpPluginHooks;
}

export type PluginHookKeys = keyof HttpPluginHooks;
export type PluginKeys = keyof Omit<Plugin, 'name' | 'hooks'>;
