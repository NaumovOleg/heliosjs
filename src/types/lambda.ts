import { APIGatewayProxyEvent, APIGatewayProxyEventV2, Handler } from 'aws-lambda';
import { HTTP_METHODS } from './common';
import { ControllerClass } from './controller';
import { MultipartFile } from './multipart';
import { LambdaPlugin } from './plugins';

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

export interface LambdaRequest {
  event?: any;
  context?: any;
  requestId?: string;
  stage?: string;
  sourceIp?: string;
  userAgent?: string;
}

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  multiValueHeaders?: Record<string, string[]>;
  cookies?: string[];
}

export interface LambdaApp {
  beforeStart?: () => void;
}

export interface Lambda {
  beforeStart?: () => Promise<void>;
  handleRequest(request: any): Promise<any>;
}

export interface ILRequest {
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
  sourceIp: string;

  end(): void;
}

export interface ILResponse {
  body: any;
  setHeader(name: string, value: string): void;
  statusCode: number;
  headers: Record<string, string>;
  send(): void;
  original: any;
}

export interface ILambdaAdapter {
  handler: Handler;
  controllers: ControllerClass[];
  plugins: LambdaPlugin[];
}
