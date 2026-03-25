import {
  ALBEvent,
  ALBEventRequestContext,
  APIGatewayEventRequestContext,
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  CloudFrontEvent,
  CloudFrontRequestEvent,
  Handler,
  LambdaFunctionURLEvent,
} from 'aws-lambda';
import { Request } from '../core';
import { ControllerClass } from '../core/controller';
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

export type RequestContext =
  | ALBEventRequestContext
  | APIGatewayEventRequestContext
  | CloudFrontEvent['config']
  | APIGatewayEventRequestContextV2;

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
  requestContext: RequestContext;
}

export interface LambdaApp {
  beforeStart?: () => void;
}

export interface Lambda {
  beforeStart?: () => Promise<void>;
  handleRequest(request: Request): Promise<any>;
}

export interface ILambdaAdapter {
  handler: Handler;
  controllers: ControllerClass[];
  plugins: Plugin[];
}
