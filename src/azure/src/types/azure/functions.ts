import type { ControllerType, CORSConfig, FingerprintConfig, RBACConfig } from '@heliosjs/core/types';
import type { HttpHandler } from '@azure/functions';
import type { Plugin } from './plugin';

/** Public surface of the Azure Functions adapter ({@link Helios} in `@heliosjs/azure`). */
export interface IAzureAdapter {
  /** The Azure Functions `HttpHandler` to register via `app.http(name, { handler: app.handler })`. */
  handler: HttpHandler;
  /** The compiled root controller instance. */
  controller: ControllerType;
  /** Registered plugins. */
  plugins: Plugin[];
}

/** Second argument to the `@heliosjs/azure` `Helios` constructor. */
export interface AzureOptions {
  /** Role-based access control configuration consumed by the `@Roles` guard. */
  rbac?: RBACConfig;
  /** Request fingerprinting configuration consumed by `@Fingerprint()` / `@UseFingerprint()`. */
  fingerprint?: FingerprintConfig;
  /** CORS configuration. If not provided, no origin validation is performed. */
  cors?: CORSConfig;
  /**
   * Trust `X-Forwarded-For` / `X-Forwarded-Proto` for `req.getClientIp()` /
   * `req.isSecure()`. Defaults to `true` — the Azure Functions host sets
   * these; disable only if you terminate untrusted traffic directly.
   */
  trustProxy?: boolean;
}
