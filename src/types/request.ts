import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { IncomingHttpHeaders } from 'http';
import { LambdaEvent } from './lambda';
export type RequestSource = 'http' | 'lambda' | 'unknown';

export interface RequestOptions {
  method: string;
  requestUrl: URL;
  url: string;
  path: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: any;
  params: Record<string, string>;
  cookies: Record<string, string>;
  sourceIp?: string;
  userAgent?: string;
  requestId: string;
  stage?: string;
  timestamp: Date;
  raw?: any;
  context?: any;
  rawBody?: any;
  event?: LambdaEvent;
  isBase64Encoded?: boolean;
}

export interface IRequest {
  // Readonly properties
  method: string;
  path: string;
  url: string;
  requestUrl: URL;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: any;
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
  rawBody: any;
  isBase64Encoded: any;
  startTime: number;
  // Header methods
  getHeader(name: string): string | string[] | undefined;

  // Cookie methods
  getCookie(name: string): string | undefined;

  // Query methods
  getQuery(name: string): string | string[] | undefined;

  // Parameter methods
  getParam(name: string): string | undefined;

  // Source detection
  isHttp(): boolean;
  isLambda(): boolean;

  // Lambda specific
  getLambdaEvent(): APIGatewayProxyEvent | undefined;
  getLambdaContext(): Context | undefined;

  // HTTP specific
  getHttpRequest(): IncomingHttpHeaders | undefined;

  // State management
  setState(key: string, value: any): void;
  getState<T = any>(key: string): T | undefined;
  getAllState(): Map<string, any>;

  // Utility methods
  isSecure(): boolean;
  getClientIp(): string;
  getHost(): string;
  getFullUrl(): string;

  // Clone method
  clone(overrides?: Partial<RequestOptions>): IRequest;

  // Serialization
  toJSON(): Record<string, any>;
}
