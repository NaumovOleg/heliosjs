import type { ControllerType, CORSConfig, FingerprintConfig, RBACConfig, Request } from '@heliosjs/core/types';
import type {
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
import type { Plugin } from './plugin';

/**
 * Shape of a Lambda **Function URL** invocation event (a stripped-down variant of
 * the API Gateway HTTP API v2 payload). Helios normalizes this into the core
 * {@link Request}.
 */
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

/** Union of the `requestContext` shapes across the supported event sources. */
export type RequestContext =
  | ALBEventRequestContext
  | APIGatewayEventRequestContext
  | CloudFrontEvent['config']
  | APIGatewayEventRequestContextV2;

/**
 * Every Lambda invocation event `app.handler` accepts. Helios detects which one
 * it received (`getEventType`) and normalizes all of them to the core
 * {@link Request}:
 * - `APIGatewayProxyEvent` — API Gateway **REST API** (v1);
 * - `APIGatewayProxyEventV2` — API Gateway **HTTP API** (v2);
 * - `LambdaFunctionUrlEvent` / `LambdaFunctionURLEvent` — **Lambda Function URL**;
 * - `ALBEvent` — **Application Load Balancer** target;
 * - `CloudFrontRequestEvent` — **CloudFront** Lambda@Edge request.
 */
export type LambdaEvent =
  | ALBEvent
  | LambdaFunctionURLEvent
  | CloudFrontRequestEvent
  | APIGatewayProxyEvent // REST API (v1)
  | APIGatewayProxyEventV2 // HTTP API (v2)
  | LambdaFunctionUrlEvent; // Lambda Function URL

/** Internal: the common shape every {@link LambdaEvent} is flattened to before building a `Request`. */
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
  request(request: Request): Promise<unknown>;
}

/** Public surface of the Lambda adapter ({@link Helios} in `@heliosjs/aws`). */
export interface ILambdaAdapter {
  /** The AWS Lambda `Handler` to export from your entry module. */
  handler: Handler;
  /** The compiled root controller instance. */
  controller: ControllerType;
  /** Registered plugins. */
  plugins: Plugin[];
}

/** Second argument to the `@heliosjs/aws` `Helios` constructor. */
export interface LambdaOptions {
  /** Role-based access control configuration consumed by the `@Roles` guard. */
  rbac?: RBACConfig;
  /** Request fingerprinting configuration consumed by `@Fingerprint()` / `@UseFingerprint()`. */
  fingerprint?: FingerprintConfig;
  /** CORS configuration. If not provided, no origin validation is performed. */
  cors?: CORSConfig;
  /**
   * Trust `X-Forwarded-For` / `X-Forwarded-Proto` for `req.getClientIp()` /
   * `req.isSecure()`. Defaults to `true` — API Gateway / ALB / CloudFront set
   * these; disable only if you terminate untrusted traffic directly.
   */
  trustProxy?: boolean;
}
