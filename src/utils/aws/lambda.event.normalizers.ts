// parsers/event-normalizers.ts
import { LambdaEvent } from '../../types/aws';
import { HTTP_METHODS, RequestOptions } from '../../types/core';

import {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  CloudFrontRequest,
  CloudFrontRequestEvent,
  Context,
  LambdaFunctionURLEvent,
} from 'aws-lambda';
import { parseBody, parseHeaders, parseQuery, parseRequestCookie } from '../shared';
import { getMultiValueQueryStringParameters, getQueryStringParameters } from './lambda';
import { parseCloudFrontHeaders } from './parsers';

const getUrls = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | ALBEvent | CloudFrontRequest,
) => {
  const protocol = event.headers?.['x-forwarded-proto'] || 'https';
  const host = event.headers?.host || 'localhost';
  const path = (event as APIGatewayProxyEvent).path ?? (event as APIGatewayProxyEventV2).rawPath;
  let url = `${protocol}://${host}${path}`;
  const requestUrl = new URL(url);
  return { requestUrl, url };
};

/**
 * Safely convert path parameters
 */
const normalizePathParams = (
  params?: APIGatewayProxyEvent['pathParameters'] | Record<string, string | undefined> | null,
): Record<string, string> => {
  const result: Record<string, string> = {};

  if (!params) return result;

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  });

  return result;
};

// ==================== API Gateway v1 (REST API) ====================

export const normalizeAPIGatewayEvent = (
  event: APIGatewayProxyEvent,
  context: Context,
): RequestOptions => {
  const headers = parseHeaders(event.headers);
  const body = parseBody({ headers, body: event.body, isBase64Encoded: event.isBase64Encoded });
  const cookies = parseRequestCookie(headers?.Cookie || headers?.cookie || headers.cookies);
  const rawBody = Buffer.from(event.body || '', 'base64');

  const { url, requestUrl } = getUrls(event);

  return {
    requestId: context.awsRequestId,
    method: event.httpMethod as HTTP_METHODS,
    url,
    requestUrl,
    path: event.path,
    cookies,
    headers,
    query: getQueryStringParameters(event) ?? getMultiValueQueryStringParameters(event),
    params: normalizePathParams(event.pathParameters),
    rawBody,
    body,
    source: 'lambda',
    timestamp: new Date(),
    isBase64Encoded: event.isBase64Encoded || false,
    context: context,
    event,
    sourceIp: event.requestContext?.identity?.sourceIp,
    userAgent:
      typeof event.headers?.['user-agent'] === 'string' ? event.headers['user-agent'] : undefined,
  };
};

// ==================== API Gateway v2 (HTTP API) ====================

export const normalizeAPIGatewayV2Event = (
  event: APIGatewayProxyEventV2,
  context: Context,
): RequestOptions => {
  const rawBody = Buffer.from(event.body || '', 'base64');
  const headers = parseHeaders(event.headers);
  const body = parseBody({ headers, body: event.body, isBase64Encoded: event.isBase64Encoded });
  const { url, requestUrl } = getUrls(event);

  const cookies = parseRequestCookie(headers?.Cookie || headers?.cookie || headers.cookies);

  return {
    requestId: context.awsRequestId,
    method: event.requestContext.http.method as HTTP_METHODS,
    url,
    requestUrl,
    path: event.rawPath,
    cookies,
    headers,
    query: getQueryStringParameters(event),
    params: normalizePathParams(event.pathParameters),
    rawBody,
    body,
    source: 'lambda',
    timestamp: new Date(),
    event,
    context,
    isBase64Encoded: event.isBase64Encoded || false,
    sourceIp: event.requestContext?.http?.sourceIp,
    userAgent:
      typeof event.headers?.['user-agent'] === 'string' ? event.headers['user-agent'] : undefined,
  };
};

// // ==================== Application Load Balancer ====================

export const normalizeALBEvent = (event: ALBEvent, context: Context): RequestOptions => {
  const rawBody = Buffer.from(event.body || '', 'base64');
  const headers = parseHeaders(event.headers);
  const cookies = parseRequestCookie(headers?.Cookie || headers?.cookie || headers.cookies);
  const body = parseBody({ headers, body: event.body });
  const { url, requestUrl } = getUrls(event);

  return {
    requestId: context.awsRequestId,
    method: event.httpMethod,
    url,
    requestUrl,
    path: event.path,
    cookies,
    headers,
    query: getQueryStringParameters(event) ?? getMultiValueQueryStringParameters(event),
    params: {},
    rawBody,
    body,
    event,
    context,
    source: 'lambda',
    timestamp: new Date(),
    isBase64Encoded: !!event.isBase64Encoded,
    sourceIp: event.headers?.['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: event.headers?.['user-agent'],
  };
};

// // ==================== CloudFront ====================

export const normalizeCloudFrontEvent = (
  event: CloudFrontRequestEvent,
  context: Context,
): RequestOptions => {
  const record = event.Records?.[0];
  const request = record?.cf?.request;
  const headers = parseCloudFrontHeaders(request?.headers);
  const cookies = parseRequestCookie(headers?.Cookie || headers?.cookie || headers.cookies);
  const rawBody = Buffer.from(request.body?.data || '', 'base64');

  const isBase64Encoded = request.body?.encoding === 'base64';
  const body = parseBody({ headers, body: request.body, isBase64Encoded });

  const sourceIp =
    request?.clientIp ||
    headers['cloudfront-viewer-address']?.toString().split(':')[0] ||
    headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const { url, requestUrl } = getUrls(request);

  return {
    requestId: context.awsRequestId,
    method: request?.method,
    path: request?.uri || '/',
    url,
    requestUrl,
    headers,
    cookies,
    query: parseQuery(requestUrl),
    params: {},
    rawBody,
    body,
    context,
    event,
    source: 'lambda',
    timestamp: new Date(),
    isBase64Encoded: request.body?.encoding === 'base64',
    sourceIp,
    userAgent: headers['user-agent']?.toString(),
  };
};

// parsers/lambda-function-url.ts

export interface LambdaFunctionUrlEvent {
  version: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
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
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

/**
 * Нормализует Lambda Function URL event
 */
export const normalizeLambdaFunctionUrlEvent = (
  event: LambdaFunctionURLEvent,
  context: Context,
): RequestOptions => {
  const query: Record<string, string | string[]> = {};
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      query[key] = value + '';
    });
  } else if (event.rawQueryString) {
    const params = new URLSearchParams(event.rawQueryString);
    params.forEach((value, key) => {
      const values = params.getAll(key);
      query[key] = values.length > 1 ? values : value;
    });
  }
  const cookies: Record<string, string> = {};
  if (event.cookies) {
    event.cookies.forEach((cookie) => {
      const [name, value] = cookie.split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }

  const protocol = event.requestContext.http.protocol.split('/')[0].toLowerCase();
  const host = event.requestContext.domainName;
  const path = event.rawPath;
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const fullUrl = `${protocol}://${host}${path}${queryString}`;
  const requestUrl = new URL(fullUrl);

  let body: any = event.body || {};
  if (event.body && event.isBase64Encoded) {
    try {
      body = Buffer.from(event.body, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Failed to decode base64 body:', error);
    }
  }
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        body = JSON.parse(body);
      } catch {}
    }
  }

  const headers: Record<string, string | string[]> = {};
  Object.entries(event.headers).forEach(([key, value]) => {
    headers[key] = value + '';
  });

  return {
    source: 'lambda',
    method: event.requestContext.http.method,
    path: event.rawPath,
    requestUrl,
    url: requestUrl.toString(),
    headers,
    query,
    body,
    params: {},
    cookies,
    sourceIp: event.requestContext.http.sourceIp,
    userAgent: event.requestContext.http.userAgent,
    requestId: context.awsRequestId,
    stage: event.requestContext.stage,
    timestamp: new Date(event.requestContext.timeEpoch),
    raw: event,
    context,
    isBase64Encoded: !!event.isBase64Encoded,
  };
};

export type LambdaEventType =
  | 'apigateway'
  | 'apigatewayv2'
  | 'alb'
  | 'cloudfront'
  | 'lambda-url'
  | 'unknown';

export const getLambdaEventType = (event: any): LambdaEventType => {
  if (event.version === '2.0' && event.rawPath && event.requestContext?.http) {
    return 'lambda-url';
  }
  if (event.requestContext?.apiId && event.httpMethod) return 'apigateway';
  if (event.version === '2.0' || event.requestContext?.http) return 'apigatewayv2';
  if (event.requestContext?.elb) return 'alb';
  if (event.Records?.[0]?.cf) return 'cloudfront';

  return 'unknown';
};

export const normalizeEvent = (event: LambdaEvent, context: Context): RequestOptions => {
  const type = getLambdaEventType(event);

  switch (type) {
    case 'apigateway':
      return normalizeAPIGatewayEvent(event as APIGatewayProxyEvent, context);
    case 'apigatewayv2':
      return normalizeAPIGatewayV2Event(event as APIGatewayProxyEventV2, context);
    case 'alb':
      return normalizeALBEvent(event as ALBEvent, context);
    case 'cloudfront':
      return normalizeCloudFrontEvent(event as CloudFrontRequestEvent, context);
    case 'lambda-url':
      return normalizeLambdaFunctionUrlEvent(event as LambdaFunctionURLEvent, context);

    default:
      throw new Error(`Unsupported event type: ${type}`);
  }
};
