import { PluginDispatch } from '@heliosjs/core/utils';
import type { Plugin as LambdaPlugin } from '../../types/aws';

/**
 * `@heliosjs/aws`'s plugin dispatcher — see `PluginDispatch` in
 * `@heliosjs/core` for the shared register/dispatch logic this builds on.
 * Unlike `@heliosjs/http`, there is no global middleware-chain concept here
 * at all (`lambda.ts` has nothing that reads or runs one), so `usePlugin`
 * needs nothing beyond the base class's register-and-run-onInit behavior.
 */
export class Plugin extends PluginDispatch<LambdaPlugin> {}
