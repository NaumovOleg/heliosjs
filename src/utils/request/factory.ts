// core/RequestFactory.ts
import { Context } from 'aws-lambda';

import { LambdaEvent } from '@types';
import { IncomingMessage } from 'http';
import { v4 } from 'uuid';
import { getEventType, getSourceIp } from '../lambda';
import { normalizeLambdaEvent, parceBody } from '../parsers';
import { collectRawBody } from '../server';
import { parseQuesry, parseRequestCookie } from './helpers';
import { Request } from './request';

export class RequestFactory {
  /**
   * Create Request from HTTP IncomingMessage
   */
  static async fromHttp(req: IncomingMessage): Promise<Request> {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost';
    const fullUrl = `${protocol}://${host}${req.url}`;
    const requestUrl = new URL(fullUrl);
    const cookies = parseRequestCookie('http', req.headers?.cookie);
    const query = parseQuesry(requestUrl);

    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const sourceIp =
      forwardedFor?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      req.socket.remoteAddress ??
      '0.0.0.0';

    const rawBody = await collectRawBody(req);

    const body = parceBody({
      body: rawBody,
      headers: req.headers,
      isBase64Encoded: false,
    });

    Object.assign(req, { body });

    return new Request({
      url: req.url ?? '/',
      requestUrl,
      source: 'http',
      method: req.method || 'GET',
      path: requestUrl.pathname || '/',
      headers: req.headers as Record<string, string | string[]>,
      query,
      body,
      params: {},
      cookies,
      sourceIp,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      requestId: v4(),
      stage: 'http',
      timestamp: new Date(),
      raw: req,
      context: req.socket,
      rawBody,
      isBase64Encoded: false,
    });
  }

  /**
   * Create Request from Lambda event
   */
  static fromLambda(event: LambdaEvent, context: Context) {
    const normalized = normalizeLambdaEvent(event, getEventType(event));
    const query: Record<string, string | string[]> = {};

    if (normalized.multiValueQueryStringParameters) {
      Object.entries(normalized.multiValueQueryStringParameters).forEach(([key, value]) => {
        query[key] = value;
      });
    } else {
      Object.entries(normalized.queryStringParameters).forEach(([key, value]) => {
        query[key] = value;
      });
    }
    const cookieHeader = event.headers?.Cookie || event.headers?.cookie || event.headers?.cookies;
    const cookies = parseRequestCookie('lambda', cookieHeader);

    let rawBody = Buffer.from(event.body ?? '', 'base64');

    const body = parceBody({
      body: rawBody,
      headers: event.headers,
      isBase64Encoded: event.isBase64Encoded,
    });

    const xForvarded = Array.isArray(event.headers['x-forwarded-proto'])
      ? event.headers['x-forwarded-proto']?.[0]
      : event.headers['x-forwarded-proto'];

    const xhost = Array.isArray(event.headers['host'])
      ? event.headers['host']?.[0]
      : event.headers['host'];

    let userAgent =
      typeof event.headers['user-agent'] === 'string'
        ? event.headers['user-agent']
        : event.headers['user-agent']?.[0] || 'unknown';

    const protocol = xForvarded || 'https';
    const host = xhost || 'localhost:3000';
    const fullUrl = `${protocol}://${host}${normalized.path}`;
    const requestUrl = new URL(fullUrl);
    return new Request({
      source: 'lambda',
      requestUrl,
      url: normalized.path,
      method: normalized.httpMethod,
      path: normalized.path,
      headers: normalized.headers || {},
      query,
      body,
      params: normalized.pathParameters,
      cookies,
      sourceIp: getSourceIp(normalized),
      userAgent,
      requestId: context.awsRequestId,
      stage: normalized.requestContext?.stage || '$default',
      timestamp: new Date(),
      raw: event,
      context,
      rawBody,
      isBase64Encoded: !!event.isBase64Encoded,
    });
  }

  /**
   * Create Request from generic object
   */
  static fromObject(obj: Record<string, any>): Request {
    return new Request({
      requestUrl: new URL(obj.path),
      url: obj.path,
      source: obj.source || 'unknown',
      method: obj.method || 'GET',
      path: obj.path || '/',
      headers: obj.headers || {},
      query: obj.query || {},
      body: obj.body,
      params: obj.params || {},
      cookies: obj.cookies || {},
      sourceIp: obj.sourceIp || '0.0.0.0',
      userAgent: obj.userAgent || 'unknown',
      requestId: obj.requestId,
      stage: obj.stage || 'dev',
      timestamp: obj.timestamp ? new Date(obj.timestamp) : new Date(),
      raw: obj.raw,
      context: obj.context,
      isBase64Encoded: false,
    });
  }
}
