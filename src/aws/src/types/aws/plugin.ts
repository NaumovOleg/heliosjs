import type { Request, Response } from '@heliosjs/core/types';
import type { Context } from 'aws-lambda';
import type { ILambdaAdapter, LambdaEvent } from './lambda';

/** Request-lifecycle hooks a Lambda plugin can implement. All optional. */
export interface Hooks {
  /** Runs first, with the raw Lambda event/context, before a `Request` is built. */
  beforeRequest?: (req: LambdaEvent, context: Context) => void | Promise<void>;
  /** Runs after the `Request`/`Response` exist but before the controller dispatches. */
  beforeRoute?: (req: Request, response: Response) => void | Promise<void>;
  /** Runs after the handler produced a response, before it is converted to the Lambda result. */
  afterResponse?: (req: Request, res: Response) => void | Promise<void>;
}

export type PluginHookKeys = keyof Hooks;

/** A plugin for the `@heliosjs/aws` adapter. */
export interface Plugin {
  /** Unique plugin name, used in log lines. */
  name: string;
  /**
   * One-time setup, called synchronously when the plugin is registered via
   * `usePlugin` — typically at cold start, before any invocation exists.
   * Only `app` is available; there is no live event/`Context` yet. Use
   * `hooks.beforeRequest` for per-invocation access to those.
   */
  onInit?(app: ILambdaAdapter): void | Promise<void>;
  /** Per-request lifecycle hooks. */
  hooks?: Hooks;
}
export type PluginKeys = keyof Omit<Plugin, 'name' | 'hooks'>;
