import { CookieOptions, LambdaResponse } from '@types';

export class LResponse implements LambdaResponse {
  private _statusCode: number = 200;
  private _headers: Record<string, string> = {};
  body: any = null;
  isBase64Encoded?: boolean;
  _cookies: string[];

  setCookie(name: string, value: string, options?: CookieOptions): void {
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (options) {
      if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
      if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
      if (options.domain) cookie += `; Domain=${options.domain}`;
      if (options.path) cookie += `; Path=${options.path}`;
      if (options.secure) cookie += `; Secure`;
      if (options.httpOnly) cookie += `; HttpOnly`;
      if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
      if (options.priority) cookie += `; Priority=${options.priority}`;
      if (options.partitioned) cookie += `; Partitioned`;
    }

    this._cookies.push(cookie);
    this._updateCookieHeader();
  }

  clearCookie(name: string, options?: { path?: string; domain?: string }): void {
    const cookie = `${name}=; Max-Age=0; Expires=${new Date(0).toUTCString()}${
      options?.path ? `; Path=${options.path}` : ''
    }${options?.domain ? `; Domain=${options.domain}` : ''}`;

    this._cookies.push(cookie);
    this._updateCookieHeader();
  }

  getCookies(): string[] {
    return [...this._cookies];
  }

  clearAllCookies(): void {
    this._cookies = [];
    delete this._headers['Set-Cookie'];
  }

  private _updateCookieHeader(): void {
    if (this._cookies.length > 0) {
      this._headers['Set-Cookie'] = this._cookies.join(', ');
    } else {
      delete this._headers['Set-Cookie'];
    }
  }

  setHeader(name: string, value: string): void {
    this._headers[name] = value;
  }

  set statusCode(code: number) {
    this._statusCode = code;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  get headers(): Record<string, string> {
    return { ...this._headers };
  }
}
