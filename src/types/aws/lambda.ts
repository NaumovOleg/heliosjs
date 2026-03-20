import {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  CloudFrontRequestEvent,
  Context,
  Handler,
  LambdaFunctionURLEvent,
} from 'aws-lambda';
import { HTTP_METHODS } from '../core/common';
import { ControllerClass } from '../core/controller';
import { MultipartFile } from '../core/multipart';
import { CookieOptions } from '../core/response';
import { Plugin } from './plugin';

export interface LambdaFunctionUrlEvent {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
}

export type LambdaEvent =
  | ALBEvent
  | LambdaFunctionURLEvent
  | CloudFrontRequestEvent
  | APIGatewayProxyEvent // REST API (v1)
  | APIGatewayProxyEventV2 // HTTP API (v2)
  | LambdaFunctionUrlEvent; // Lambda Function URL

export interface NormalizedEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string | string[]>;
  queryStringParameters: Record<string, string>;
  multiValueQueryStringParameters?: Record<string, string[]>;
  pathParameters: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
  cookies?: string[];
  requestContext: any;
}

export interface LambdaRequestMeta {
  event: LambdaEvent;
  context: Context;
  requestId?: string;
  stage?: string;
  sourceIp?: string;
  userAgent?: string;
}

export interface LambdaApp {
  beforeStart?: () => void;
}

export interface Lambda {
  beforeStart?: () => Promise<void>;
  handleRequest(request: any): Promise<any>;
}

export interface LambdaRequest {
  requestUrl: URL;
  method: HTTP_METHODS;
  path?: string;
  headers: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  body: any;
  rawBody: Buffer<ArrayBufferLike>;
  isBase64Encoded?: boolean;
  cookies: Record<string, string>;
  multipart?: Record<string, MultipartFile | MultipartFile[]>;
  _startTime: number;
  url: string;
  requestId: string;
  stage?: string;
  userAgent: string;
  event: LambdaEvent;
  context: Context;
  id: string;
  ip: string;
  end(): void;
}

export interface LambdaResponse {
  body: any;
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  isBase64Encoded?: boolean;
  status: number;

  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: { path?: string; domain?: string }): void;
  getCookies(): string[];
  clearAllCookies(): void;
}

export interface ILambdaAdapter {
  handler: Handler;
  controllers: ControllerClass[];
  plugins: Plugin[];
}
