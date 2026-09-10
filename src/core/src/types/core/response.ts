/** Where a response is being sent through: a Node HTTP server, AWS Lambda, or unknown. */
export type ResponseSource = 'http' | 'lambda' | 'unknown';

/** Options accepted by {@link Response.setCookie} / {@link Response.clearCookie}. */
export interface CookieOptions {
  /** Lifetime in seconds. Omit for a session cookie. */
  maxAge?: number;
  /** Absolute expiry date; use `maxAge` instead when possible. */
  expires?: Date;
  /** Cookie scope path. Default `'/'`. */
  path?: string;
  /** Cookie scope domain. */
  domain?: string;
  /** Send only over HTTPS. Why: required alongside `sameSite: 'none'`. */
  secure?: boolean;
  /** Hide from `document.cookie` (JS). Why: mitigates XSS token theft. */
  httpOnly?: boolean;
  /**
   * Cross-site sending policy: `'strict'` (never cross-site), `'lax'` (top-level
   * navigations only, the browser default), `'none'` (always — requires
   * `secure: true`). Why: CSRF defense.
   */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Cookie eviction priority hint: `'low'`, `'medium'`, `'high'`. */
  priority?: 'low' | 'medium' | 'high';
  /** Opt into the CHIPS partitioned-cookie model (third-party contexts). */
  partitioned?: boolean;
}

/** Fields accepted to build/replace a {@link Response}. */
export interface ResponseOptions {
  /** HTTP status code. */
  statusCode?: number;
  /** Response headers. */
  headers?: Record<string, string | string[]>;
  /** Response body (object, string, or Buffer). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  /** Raw `Set-Cookie` header lines. */
  cookies?: string[];
  /** Whether `body` should be treated/encoded as base64 (Lambda binary). */
  isBase64Encoded?: boolean;
  /** Encoding used when writing a string/Buffer body. */
  encoding?: BufferEncoding;
}

/** Internal: subset of the underlying transport response `Response.raw` exposes. */
export type _Raw = Partial<{
  headersSent: boolean;
  statusCode: number;
  headers: Record<string, string | string[]>;
  cookies: string[];
  end(args: unknown): unknown;
  setHeader(name: string, value: string | string[]): void;
  removeHeader(name: string): void;
  requestUrl: URL;
  method: string;
  requestId: string;
  sourceIp: string;
  userAgent: string;
  startTime: number;
}>;

/**
 * The transport-agnostic response object middlewares, guards, interceptors, and
 * (via `@Res()`) handlers write to. Same shape on `node:http` and Lambda; on
 * Lambda `end()`/header writes update internal state that is later converted to
 * the Lambda result object rather than hitting a live socket.
 */
export interface Response {
  /** Response headers set so far. Prefer the `setHeader`/`getHeader` methods. */
  headers: Record<string, string | string[]>;
  /** Response body. Handlers normally set this by returning a value; write directly to override. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  /** Raw `Set-Cookie` header lines accumulated via `setCookie`/`clearCookie`. */
  cookies: string[];
  /** Whether `data` should be sent/encoded as base64 (Lambda binary). */
  isBase64Encoded: boolean;
  /** Transport the response is being sent through; see {@link ResponseSource}. */
  source: ResponseSource;
  /** Underlying transport response object. Escape hatch. */
  raw: _Raw;
  /** `true` once headers have been flushed — further header/status writes are no-ops. */
  headersSent: boolean;
  /** `true` when `redirect()` was called. */
  isRedirect: boolean;
  /** `true` when `status` is in the 2xx range. */
  ok: boolean;
  /** Snapshot of the originating request's URL and method, for logging. */
  meta: { requestUrl: URL; method: string };

  /** Get/set the HTTP status code directly. */
  status: number;
  /** Returns the current HTTP status code (same as reading `.status`). */
  getStatus(): number;

  /**
   * Sets a response header, replacing any existing value.
   * @param name - Header name.
   * @param value - Header value, or an array for a multi-value header.
   */
  setHeader(name: string, value: string | string[]): this;
  /**
   * Returns a previously set header's value.
   * @param name - Header name.
   */
  getHeader(name: string): string | string[] | undefined;
  /**
   * `true` if `name` has been set.
   * @param name - Header name.
   */
  hasHeader(name: string): boolean;
  /**
   * Removes a previously set header.
   * @param name - Header name.
   */
  removeHeader(name: string): this;
  /**
   * Sets multiple headers at once.
   * @param headers - Map of header name to value.
   */
  setHeaders(headers: Record<string, string | string[]>): this;

  /**
   * Appends a `Set-Cookie` header.
   * @param name - Cookie name.
   * @param value - Cookie value.
   * @param options - {@link CookieOptions} (expiry, scope, security flags).
   */
  setCookie(name: string, value: string, options?: CookieOptions): this;
  /**
   * Appends a `Set-Cookie` that expires the named cookie immediately. Pass the
   * same `path`/`domain` the cookie was set with.
   * @param name - Cookie name to clear.
   * @param options - Scope options; `maxAge`/`expires` are overridden.
   */
  clearCookie(name: string, options?: CookieOptions): this;
  /** Returns the accumulated `Set-Cookie` lines. */
  getCookies(): string[];

  /**
   * Sets `Location` and status for a redirect and marks `isRedirect`.
   * @param url - Target URL.
   * @param statusCode - Redirect status. Default `302`.
   */
  redirect(url: string, statusCode?: number): this;
  /**
   * Finalizes and sends the response with `data` as the body. Adapters call this
   * automatically after the handler returns; call it yourself only for manual
   * control (e.g. streaming).
   * @param data - Body to send.
   */
  end(data: unknown): unknown;

  /**
   * Serializes `data` as an error payload (via `ApplicationError`) and stores it
   * on `.data`, setting `.status` from the error. Used internally when a handler
   * throws or returns an `Error`.
   * @param data - The error (or error-shaped value) to serialize.
   */
  error(data: unknown): this;

  /** Resets status/headers/body/cookies to their initial state. */
  reset(): this;
  /** Plain-object view of the response, for logging/serialization. */
  toJSON(): Record<string, unknown>;
}
