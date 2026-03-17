import { HTTP_METHODS, LambdaEvent, LambdaRequest, MultipartFile } from '@types';
import { Context } from 'aws-lambda';
import { getEventType, getSourceIp, normalizeEvent } from './helpers';

export class LRequest implements LambdaRequest {
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

  constructor(lambdaEvent: LambdaEvent, context: Context) {
    const event = normalizeEvent(lambdaEvent, getEventType(lambdaEvent));
    const query: Record<string, string | string[]> = {};

    this.event = lambdaEvent;
    this.context = context;

    if (event.multiValueQueryStringParameters) {
      Object.entries(event.multiValueQueryStringParameters).forEach(([key, value]) => {
        query[key] = value;
      });
    } else {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        query[key] = value;
      });
    }

    const cookies: Record<string, string> = {};
    const cookieHeader = event.headers?.Cookie || event.headers?.cookie || event.headers?.cookies;

    if (cookieHeader) {
      if (Array.isArray(cookieHeader)) {
        cookieHeader.forEach((cookie) => {
          const [name, value] = cookie.split('=');
          if (name && value) cookies[name] = decodeURIComponent(value);
        });
      } else {
        cookieHeader.split(';').forEach((cookie) => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) cookies[name] = decodeURIComponent(value);
        });
      }
    }

    let rawBody = Buffer.from(event.body ?? '', 'base64');
    let body = event.body || {};

    if (event.body && event.isBase64Encoded) {
      body = rawBody.toString('utf-8');
    }

    if (typeof body === 'string' && body.trim().startsWith('{')) {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const xForvarded = Array.isArray(event.headers['x-forwarded-proto'])
      ? event.headers['x-forwarded-proto']?.[0]
      : event.headers['x-forwarded-proto'];

    const xhost = Array.isArray(event.headers['host'])
      ? event.headers['host']?.[0]
      : event.headers['host'];

    const protocol = xForvarded || 'https';
    const host = xhost || 'localhost:3000';
    const fullUrl = `${protocol}://${host}${event.path}`;

    let url = new URL(fullUrl);
    this.method = event.httpMethod.toUpperCase() as HTTP_METHODS;
    this.url = fullUrl;
    this.headers = event.headers;
    this.cookies = cookies;
    this.params = event.pathParameters;
    this.rawBody = rawBody;
    this.body = body;
    this.path = event.path;
    this.isBase64Encoded = event.isBase64Encoded;
    this.requestId = context.awsRequestId;
    this.requestUrl = url;
    this.stage = event.requestContext?.stage || '$default';
    this.ip = getSourceIp(event);
    this.id = context.awsRequestId;

    this.userAgent =
      typeof event.headers['user-agent'] === 'string'
        ? event.headers['user-agent']
        : event.headers['user-agent']?.[0] || 'unknown';
  }
  sourceIp: string;

  end() {
    console.log('NOT implemented for  lambda');
  }
}
