export type ResponseSource = 'http' | 'lambda' | 'unknown';

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  priority?: 'low' | 'medium' | 'high';
  partitioned?: boolean;
}

export interface ResponseOptions {
  statusCode?: number;
  headers?: Record<string, string | string[]>;
  body?: any;
  cookies?: string[];
  isBase64Encoded?: boolean;
  encoding?: BufferEncoding;
}

export interface Response {
  headers: Record<string, string | string[]>;
  data: any;
  cookies: string[];
  isBase64Encoded: boolean;
  source: ResponseSource;
  raw: any;
  headersSent: boolean;
  ok: boolean;
  meta: { requestUrl: URL; method: string };

  // Status methods
  status: number;
  getStatus(): number;

  // Header methods
  setHeader(name: string, value: string | string[]): this;
  getHeader(name: string): string | string[] | undefined;
  hasHeader(name: string): boolean;
  removeHeader(name: string): this;
  setHeaders(headers: Record<string, string | string[]>): this;

  // Cookie methods
  setCookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string, options?: CookieOptions): this;
  getCookies(): string[];

  // Response methods
  redirect(url: string, statusCode?: number): this;
  end(data: unknown): this;

  error(data: unknown): this;

  reset(): this;
  toJSON(): Record<string, any>;
}
