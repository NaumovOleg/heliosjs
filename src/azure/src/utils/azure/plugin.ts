import { PluginDispatch } from '@heliosjs/core/utils';
import type { Plugin as AzurePlugin } from '../../types/azure';

/**
 * `@heliosjs/azure`'s plugin dispatcher — see `PluginDispatch` in
 * `@heliosjs/core` for the shared register/dispatch logic this builds on.
 * No global middleware-chain concept here either (same as `@heliosjs/aws`),
 * so `usePlugin` needs nothing beyond the base class's behavior.
 */
export class Plugin extends PluginDispatch<AzurePlugin> {}
