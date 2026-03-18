import { OK_STATUSES } from '@constants';
import { CookieOptions, IResponse, Meta, ResponseSource } from '@types';
import { ApplicationError } from '../error';

export class Response implements IResponse {
  private _status: number = 200;
  private _headers: Record<string, string | string[]> = {};
  private _data: any;
  private _cookies: string[] = [];
  private _isBase64Encoded: boolean = false;
  private _headersSent: boolean = false;
  private _source: ResponseSource;
  private _raw: any;
  meta: Meta;

  constructor(source: ResponseSource = 'unknown', meta: Meta, raw?: any) {
    this._source = source;
    this._raw = raw;
    this.meta = {
      requestUrl: meta.requestUrl,
      method: meta.method,
      requestId: meta.requestId,
      sourceIp: meta.sourceIp,
      userAgent: meta.userAgent,
      startTime: meta.startTime,
    };

    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/json');
    }
  }
  requestId: string;

  get headers(): Record<string, string | string[]> {
    return { ...this._headers };
  }

  get ok() {
    return OK_STATUSES.includes(this._status);
  }

  get data(): any {
    return this._data;
  }

  set data(data: any) {
    if (data instanceof Error) {
      let serialized = new ApplicationError(data, {
        meta: this.meta,
        config: {
          includeStack: process.env.NODE_ENV !== 'production',
          logErrors: !!process.env.LOG_ERRORS,
        },
      });
      if (this.ok) {
        this.status = serialized.status ?? 500;
      }
      this._data = serialized.toJSON();
    } else {
      this._data = data;
    }
  }

  get raw(): any {
    return this._raw;
  }

  get cookies(): string[] {
    return [...this._cookies];
  }

  get isBase64Encoded(): boolean {
    return this._isBase64Encoded;
  }

  get source(): ResponseSource {
    return this._source;
  }

  get headersSent(): boolean {
    return this.raw.headersSent ?? this._headersSent;
  }

  // ==================== Status Methods ====================

  set status(code: number) {
    this._status = code;
    if (this.raw.statusCode) {
      this.raw.statusCode = code;
    }
  }

  get status() {
    return this._status;
  }

  getStatus(): number {
    return this._status;
  }

  // ==================== Header Methods ====================

  setHeader(name: string, value: string | string[]): this {
    this._headers[name.toLowerCase()] = value;
    if (this.raw.headers) {
      this.raw.headers[name.toLowerCase()] = value;
    }
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this._headers[name.toLowerCase()];
  }

  hasHeader(name: string): boolean {
    return name.toLowerCase() in this._headers;
  }

  removeHeader(name: string): this {
    delete this._headers[name.toLowerCase()];
    if (this.raw.headers) {
      delete this.raw.headers[name.toLowerCase()];
    }
    return this;
  }

  setHeaders(headers: Record<string, string | string[]>): this {
    Object.entries(headers).forEach(([key, value]) => {
      this.setHeader(key, value);
    });
    return this;
  }

  // ==================== Cookie Methods ====================

  setCookie(name: string, value: string, options: CookieOptions = {}): this {
    const cookieValue = encodeURIComponent(value);
    const parts = [`${name}=${cookieValue}`];

    if (options.maxAge !== undefined) {
      parts.push(`Max-Age=${options.maxAge}`);
    }

    if (options.expires) {
      parts.push(`Expires=${options.expires.toUTCString()}`);
    }

    if (options.path) {
      parts.push(`Path=${options.path}`);
    } else {
      parts.push('Path=/');
    }

    if (options.domain) {
      parts.push(`Domain=${options.domain}`);
    }

    if (options.secure) {
      parts.push('Secure');
    }

    if (options.httpOnly) {
      parts.push('HttpOnly');
    }

    if (options.sameSite) {
      parts.push(`SameSite=${options.sameSite}`);
    }

    if (options.priority) {
      parts.push(`Priority=${options.priority}`);
    }

    if (options.partitioned) {
      parts.push('Partitioned');
    }

    this._cookies.push(parts.join('; '));
    if (this.raw.cookies) {
      this.raw.cookies = this._cookies;
    }
    return this;
  }

  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.setCookie(name, '', {
      ...options,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  getCookies(): string[] {
    return [...this._cookies];
  }

  // ==================== Body Methods ====================

  send(body: any): this {
    this._data = body;
    this._headersSent = true;
    this.end(this._data);
    return this;
  }

  json(data: any): this {
    this.setHeader('content-type', 'application/json');
    this._data = data;
    this._headersSent = true;
    this.end(this._data);
    return this;
  }

  text(text: string): this {
    this.setHeader('content-type', 'text/plain');
    this._data = text;
    this._headersSent = true;
    this.send(this._data);
    return this;
  }

  html(html: string): this {
    this.setHeader('content-type', 'text/html');
    this._data = html;
    this._headersSent = true;
    this.send(this._data);
    return this;
  }

  buffer(data: Buffer, contentType?: string): this {
    if (contentType) {
      this.setHeader('content-type', contentType);
    } else {
      this.setHeader('content-type', 'application/octet-stream');
    }
    this._data = data;
    this._isBase64Encoded = this._source === 'lambda';

    this._headersSent = true;
    this.send(this._data);
    return this;
  }

  stream(readable: NodeJS.ReadableStream, contentType?: string): this {
    if (this._source !== 'http') throw Error('Not implemented');
    if (contentType) {
      this.setHeader('content-type', contentType);
    }
    this._data = readable;
    this.send(this._data);
    return this;
  }

  end(data: unknown) {
    const serialized = typeof data === 'object' ? JSON.stringify(data) : data;
    this._headersSent = true;
    if (typeof this.raw.end !== 'function') {
      console.log('Method not implemented');
    }
    this.setHeader('X-Response-Time', `${Date.now() - this.meta.startTime}ms`);

    return this.raw.end(serialized);
  }

  // ==================== Response Methods ====================

  redirect(url: string, statusCode: number = 302): this {
    this._status = statusCode;
    this.setHeader('location', url);
    return this;
  }

  notFound(message: string = 'Not Found'): this {
    this._status = 404;
    this.json({ error: message });
    return this;
  }

  reset(): this {
    this._status = 200;
    this._headers = {};
    this._data = null;
    this._cookies = [];
    this._isBase64Encoded = false;
    this._headersSent = false;
    return this;
  }

  toJSON(): Record<string, any> {
    return {
      statusCode: this._status,
      headers: this._headers,
      cookies: this._cookies,
      isBase64Encoded: this._isBase64Encoded,
      data: this._data,
      source: this._source,
      meta: this.meta,
    };
  }
  error(error: any): this {
    const config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: !!process.env.LOG_ERRORS,
    };

    let serialized = new ApplicationError(error, { meta: this.meta, config });
    if (this.ok) {
      this.status = serialized.status ?? 500;
    }

    this.data = serialized;

    return this;
  }
}
