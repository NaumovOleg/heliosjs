// core/Request.ts

import type { IncomingHttpHeaders } from 'node:http';
import { URL } from 'node:url';
import type { Request, RequestOptions, RequestSource } from '../../types/core/request';

/**
 * @internal Concrete implementation of {@link Request}, constructed by
 * `RequestFactory` in each adapter. App code uses the `Request` interface
 * (via `@Req()`) rather than this class directly.
 */
export class Req implements Request {
  method: string;
  path: string;
  url: string;
  requestUrl: URL;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: unknown;
  params: Record<string, string>;
  cookies: Record<string, string>;
  sourceIp: string;
  userAgent: string;
  requestId: string;
  stage: string;
  timestamp: Date;
  source: RequestSource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  context: unknown;
  rawBody: unknown;
  isBase64Encoded: boolean;
  startTime: number;
  /** When false, `X-Forwarded-*` headers are ignored for client IP / protocol. */
  trustProxy: boolean;

  // Most requests never call setState/getState — allocate lazily instead of
  // paying for a Map on every request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _state?: Map<string, any>;
  private _signal?: AbortSignal;

  constructor(options: RequestOptions) {
    this.method = options.method.toUpperCase();
    this.path = options.path;
    this.url = options.url ?? options.path;
    this.requestUrl =
      options.requestUrl ?? new URL(options.path, `http://${options.headers?.host || 'localhost'}`);
    this.headers = options.headers || {};
    this.query = options.query || {};
    this.body = options.body;
    this.params = options.params || {};
    this.cookies = options.cookies || {};
    this.sourceIp = options.sourceIp || '0.0.0.0';
    this.userAgent = options.userAgent || 'unknown';
    this.requestId = options.requestId;
    this.stage = options.stage || 'dev';
    this.timestamp = options.timestamp || new Date();
    this.source = options.source;
    this.raw = options.raw ?? options.event;
    this.context = options.context;
    this.rawBody = options.rawBody;
    this.isBase64Encoded = options.isBase64Encoded ?? this.base64Encoded();
    this.trustProxy = options.trustProxy ?? false;
    this.startTime = Date.now();
  }

  base64Encoded(): boolean {
    if (this.isLambda() && this.raw?.isBase64Encoded) {
      return this.raw.isBase64Encoded;
    }

    const encoding = this.getHeader('content-encoding');
    if (encoding === 'base64') {
      return true;
    }

    const transferEncoding = this.getHeader('transfer-encoding');
    if (transferEncoding === 'base64') {
      return true;
    }

    return false;
  }

  /**
   * Get header value (case-insensitive)
   */
  getHeader(name: string): string | string[] | undefined {
    const lower = name.toLowerCase();
    // Fast path: Node already lower-cases header keys.
    if (Object.hasOwn(this.headers, lower)) return this.headers[lower];
    for (const key in this.headers) {
      if (Object.hasOwn(this.headers, key) && key.toLowerCase() === lower) {
        return this.headers[key];
      }
    }
    return undefined;
  }

  /**
   * Get cookie value
   */
  getCookie(name: string): string | undefined {
    return this.cookies[name];
  }

  /**
   * Get query parameter
   */
  getQuery(name: string): string | string[] | undefined {
    return this.query[name];
  }

  /**
   * Get path parameter
   */
  getParam(name: string): string | undefined {
    return this.params[name];
  }

  /**
   * Check if request is from HTTP server
   */
  isHttp(): boolean {
    return this.source === 'http';
  }

  /**
   * Check if request is from Lambda
   */
  isLambda(): boolean {
    return this.source === 'lambda';
  }

  /**
   * Get Lambda event (if from Lambda)
   */
  getLambdaEvent() {
    return this.isLambda() ? this.raw : undefined;
  }

  /**
   * Get Lambda context (if from Lambda)
   */
  getLambdaContext() {
    return this.isLambda() ? this.context : undefined;
  }

  /**
   * Get HTTP IncomingMessage (if from HTTP)
   */
  getHttpRequest(): IncomingHttpHeaders | undefined {
    return this.isHttp() ? this.raw : undefined;
  }

  /**
   * Aborts once the underlying connection is gone before a response was
   * sent. `undefined` off `node:http` — Lambda's `raw` is the event, not a
   * live connection to abort on. Built lazily on first access: nothing is
   * allocated or listened to for requests that never read this.
   *
   * `'aborted'` is Node's documented-but-soft-deprecated event for exactly
   * this (the alternative is `res.on('close')` plus checking
   * `!res.writableEnded`, which needs a reference to the Response object
   * that doesn't exist yet when `Req` is constructed) — still emitted on
   * every currently-supported Node line; revisit if that ever changes.
   */
  get signal(): AbortSignal | undefined {
    if (!this.isHttp() || typeof this.raw?.once !== 'function') return undefined;
    if (!this._signal) {
      const controller = new AbortController();
      this.raw.once('aborted', () => controller.abort());
      this._signal = controller.signal;
    }
    return this._signal;
  }

  /**
   * Store arbitrary data in request state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setState(key: string, value: any): void {
    (this._state ??= new Map()).set(key, value);
  }

  /**
   * Get stored state data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getState<T = any>(key: string): T | undefined {
    return this._state?.get(key);
  }

  /**
   * Get all stored state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllState(): Map<string, any> {
    return new Map(this._state);
  }

  /**
   * Check if request is secure (HTTPS)
   */
  isSecure(): boolean {
    if (this.trustProxy) {
      const fwd = this.getHeader('x-forwarded-proto');
      if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(',')[0].trim() === 'https';
    }
    return this.requestUrl.protocol.replace(':', '') === 'https';
  }

  /**
   * Get client IP. Honours `X-Forwarded-For` only when `trustProxy` is set;
   * otherwise returns the direct socket address.
   *
   * `trustProxy` models exactly one trusted hop in front of the app (the
   * reverse proxy / load balancer / API Gateway) — so the last entry is used,
   * since that's the one appended by that trusted hop itself. A client can
   * prepend arbitrary values to the header, so the first entry is never
   * trustworthy.
   */
  getClientIp(): string {
    if (this.trustProxy) {
      const forwarded = this.getHeader('x-forwarded-for');
      if (forwarded) {
        const ips = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
        return ips[ips.length - 1].trim();
      }
    }
    return this.sourceIp;
  }

  /**
   * Get request host
   */
  getHost(): string {
    return (this.getHeader('host') as string) || 'localhost';
  }

  /**
   * Get full URL
   */
  getFullUrl(): string {
    const protocol = this.isSecure() ? 'https' : 'http';
    return `${protocol}://${this.getHost()}${this.path}`;
  }

  /**
   * Clone request with modifications
   */
  clone(overrides?: Partial<RequestOptions>): Req {
    return new Req({
      method: overrides?.method || this.method,
      path: overrides?.path || this.path,
      headers: overrides?.headers || this.headers,
      query: overrides?.query || this.query,
      body: overrides?.body ? overrides.body : this.body,
      params: overrides?.params || this.params,
      cookies: overrides?.cookies || this.cookies,
      sourceIp: overrides?.sourceIp || this.sourceIp,
      userAgent: overrides?.userAgent || this.userAgent,
      requestId: overrides?.requestId || this.requestId,
      stage: overrides?.stage || this.stage,
      timestamp: overrides?.timestamp || this.timestamp,
      source: this.source,
      raw: this.raw,
      context: this.context,
      url: overrides?.url || this.url,
      rawBody: overrides?.rawBody ?? this.rawBody,
      isBase64Encoded: overrides?.isBase64Encoded ?? this.isBase64Encoded,
      trustProxy: overrides?.trustProxy ?? this.trustProxy,
      requestUrl: overrides?.requestUrl || this.requestUrl,
    });
  }

  /**
   * Convert to plain object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      method: this.method,
      path: this.path,
      url: this.url.toString(),
      headers: this.headers,
      query: this.query,
      body: this.body,
      params: this.params,
      cookies: this.cookies,
      sourceIp: this.sourceIp,
      userAgent: this.userAgent,
      requestId: this.requestId,
      stage: this.stage,
      timestamp: this.timestamp.toISOString(),
      source: this.source,
    };
  }
}
