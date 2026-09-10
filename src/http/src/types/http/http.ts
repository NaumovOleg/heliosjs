import type { Server } from 'node:http';
import type {
  CORSConfig,
  ControllerClass,
  ControllerType,
  ErrorHandler,
  FingerprintConfig,
  InterceptorCB,
  LoggerConfig,
  MiddlewareCB,
  RBACConfig,
  SanitizerConfig,
} from '@heliosjs/core/types';
import type { PubSub } from 'type-graphql';
import type { Plugin } from './plugin';
import type { StaticConfig } from './static';

/**
 * Effective HTTP server configuration. Assembled from the `@Server` / `@Port` /
 * `@Host` class decorators (and their merge order) plus runtime defaults, then
 * consumed by {@link Helios}. Every field is optional at the decorator boundary.
 */
export interface ServerConfig {
  /**
   * TCP port to listen on. Falls back to `listen()`'s argument, then `3000`.
   * Why: where clients reach the server.
   */
  port?: number;

  /**
   * Hostname / IP to bind. Falls back to `listen()`'s argument, then
   * `'localhost'`. Use `'0.0.0.0'` to accept external connections (containers).
   */
  host?: string;

  /**
   * Global middlewares run for every request before route dispatch, in order,
   * after plugin middlewares. Why: app-wide concerns (request id, logging).
   */
  middlewares?: MiddlewareCB[];

  /**
   * Single global interceptor applied to every handler's return value. Merged
   * into `interceptors` during config resolution. Why: uniform response
   * envelope. Prefer this over `interceptors` in user code.
   */
  interceptor?: InterceptorCB;

  /**
   * Resolved list of global interceptors (internal — populated from
   * `interceptor`). Run innermost-last, like route interceptors.
   */
  interceptors: InterceptorCB[];

  /**
   * Global fallback error handler `(error, req, res) => unknown`. Runs when no
   * route-level `@Catch` resolves a thrown error. Return a value to shape the
   * error response. Why: one place to format every unhandled error.
   */
  errorHandler?: ErrorHandler;

  /**
   * Maximum request body size in bytes. Defaults to 1 MB. `0` disables the limit.
   */
  bodyLimit?: number;

  /**
   * Trust `X-Forwarded-For` / `X-Forwarded-Proto` for `req.getClientIp()` and
   * `req.isSecure()`. Default `false` — only enable behind a proxy you control,
   * since these headers are client-spoofable and feed rate-limiting/fingerprint.
   */
  trustProxy?: boolean;

  /**
   * Node HTTP server `requestTimeout` in milliseconds. When unset, Node's default applies.
   */
  requestTimeout?: number;

  /**
   * Node HTTP server `headersTimeout` in milliseconds. When unset, Node's default applies.
   */
  headersTimeout?: number;

  /**
   * Role-based access control configuration consumed by the `@Roles` guard.
   */
  rbac?: RBACConfig;

  /**
   * Request fingerprinting configuration consumed by `@Fingerprint()` / `@UseFingerprint()`.
   */
  fingerprint?: FingerprintConfig;

  /**
   * Root controller classes (decorated with `@Controller`). Their sub-controllers
   * are discovered automatically. Why: this is the route tree.
   */
  controllers?: ControllerType[];

  /**
   * Global CORS policy applied before route dispatch. A route-level `@Cors`
   * overrides it for that route. See {@link CORSConfig}.
   */
  cors?: CORSConfig;

  /**
   * Global Joi sanitizers applied to every request before handlers. See
   * `SanitizerConfig`. Why: baseline input hardening across the app.
   */
  sanitizers?: SanitizerConfig[];

  /**
   * Static file mounts. Each entry serves files from `root` (or `path`) under the
   * URL `path`, with caching / index / dotfile `options`. Why: ship assets from
   * the same server.
   */
  statics?: StaticConfig[];

  /**
   * Logger configuration ({@link LoggerConfig}), or `false` to silence all
   * framework logging. Why: control startup/errors noise and log format.
   */
  log?: LoggerConfig | false;

  /**
   * Enables the built-in WebSocket server. `path` is the upgrade path (default
   * `'/ws'` when the block is present but `path` omitted at runtime),
   * `controllers` are the classes carrying `@OnWS` / `@Subscribe` handlers,
   * `lazy` defers server creation. Cannot be combined with `graphql`. Why:
   * opt-in real-time transport.
   */
  websocket?: { path: string; lazy?: boolean; controllers: ControllerType[] };

  /**
   * Enables the built-in Server-Sent Events server when `enabled` is `true`.
   * SSE lifecycle handlers are declared with `@OnSSE`. Why: opt-in one-way
   * streaming without WebSockets.
   */
  sse?: { enabled: boolean };

  /**
   * Enables a GraphQL endpoint (type-graphql + graphql-yoga). `path` is the
   * mount point (default `'/graphql'`), `resolvers` are the type-graphql
   * resolver classes, `playground` serves GraphiQL, `pubSub` wires
   * subscriptions over WebSocket. Cannot be combined with `websocket`. Why:
   * opt-in GraphQL alongside the REST routes.
   */
  graphql?: {
    path: string;
    playground?: boolean;
    pubSub?: PubSub;
    resolvers?: Function[];
  };
}

export interface IHttpServer {
  readonly app: Server;
  plugins: Plugin[];
  controllers: ControllerClass[];

  /**
   * Starts HTTP server
   * @param port - port
   * @param host - host
   * @returns Promise with HTTP server instance
   * @throws Error
   */
  listen(port?: number, host?: string): Promise<Server>;

  /**
   * Stops server
   * @returns Promise
   * @throws Error
   */
  close(): Promise<void>;

  /**
   * Get server status
   * @returns object with server config
   */
  status(): { running: boolean; config: ServerConfig };

  usePlugin(plugin: Plugin): IHttpServer;
}
