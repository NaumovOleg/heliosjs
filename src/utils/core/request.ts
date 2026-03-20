// core/Request.ts
import { IncomingHttpHeaders } from 'http';
import { URL } from 'url';
import { IRequest, RequestOptions, RequestSource } from '../../types/core/request';

export class Request implements IRequest {
  method: string;
  path: string;
  requestUrl: URL;
  url: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: any;
  rawBody: any;
  params: Record<string, string>;
  cookies: Record<string, string>;
  sourceIp: string;
  userAgent: string;
  requestId: string;
  stage: string;
  timestamp: Date;
  source: RequestSource;
  raw: any;
  context: any;
  isBase64Encoded: boolean;
  startTime: number;

  private _state: Map<string, any> = new Map();

  constructor(options: RequestOptions) {
    this.method = options.method.toUpperCase();
    this.path = options.path;
    this.url = options.path;
    this.requestUrl = new URL(options.path, `http://${options.headers?.host || 'localhost'}`);
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
    this.url = options.url;
    this.rawBody = options.rawBody;
    this.raw = options.raw;
    this.isBase64Encoded = options.isBase64Encoded ?? this.base64Encoded();
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
    const lowerName = name.toLowerCase();
    const entry = Object.entries(this.headers).find(([key]) => key.toLowerCase() === lowerName);
    return entry ? entry[1] : undefined;
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
   * Store arbitrary data in request state
   */
  setState(key: string, value: any): void {
    this._state.set(key, value);
  }

  /**
   * Get stored state data
   */
  getState<T = any>(key: string): T | undefined {
    return this._state.get(key);
  }

  /**
   * Get all stored state
   */
  getAllState(): Map<string, any> {
    return new Map(this._state);
  }

  /**
   * Check if request is secure (HTTPS)
   */
  isSecure(): boolean {
    const proto = this.getHeader('x-forwarded-proto') || this.requestUrl.protocol.replace(':', '');
    return proto === 'https';
  }

  /**
   * Get client IP (considering proxies)
   */
  getClientIp(): string {
    const forwarded = this.getHeader('x-forwarded-for');
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
      return ips[0].trim();
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
  clone(overrides?: Partial<RequestOptions>): Request {
    return new Request({
      method: overrides?.method || this.method,
      path: overrides?.path || this.path,
      headers: overrides?.headers || this.headers,
      query: overrides?.query || this.query,
      body: overrides?.body !== undefined ? overrides.body : this.body,
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
      url: this.url,
      isBase64Encoded: false,
      requestUrl: this.requestUrl,
    });
  }

  /**
   * Convert to plain object
   */
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
