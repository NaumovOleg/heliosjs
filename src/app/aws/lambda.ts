import { OK_STATUSES } from '@constants';
import { ParseBody } from '@utils';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyResult,
  Context,
  Handler,
} from 'aws-lambda';

import { Lambda, LambdaApp, LambdaRequest, LambdaResponse } from '@types';

export class LambdaAdapter {
  private static getHeaderValue(headers: any, headerName: string): string | undefined {
    const value = headers?.[headerName] || headers?.[headerName.toLowerCase()];

    if (!value) return undefined;

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
  static toRequest(event: APIGatewayProxyEvent, context: Context): LambdaRequest {
    const query: Record<string, string | string[]> = {};
    if (event.queryStringParameters) {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        if (event.multiValueQueryStringParameters?.[key]) {
          query[key] = event.multiValueQueryStringParameters[key];
        } else {
          query[key] = value || '';
        }
      });
    }

    const cookies: Record<string, string> = {};
    const cookieHeader = event.headers?.Cookie || event.headers?.cookie;
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
    }

    let body = ParseBody(event);
    const protocol = event.headers?.['x-forwarded-proto'] || 'http';
    const host = event.headers?.host || 'localhost';

    const cleanPath = event.path.split('?')[0];

    const fullUrl = `${protocol}://${host}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;

    let url: URL;
    try {
      url = new URL(fullUrl);

      if (event.queryStringParameters) {
        Object.entries(event.queryStringParameters).forEach(([key, value]) => {
          if (value) url.searchParams.append(key, value);
        });
      }
    } catch (error) {
      console.error('❌ Failed to create URL:', fullUrl, error);
      url = new URL('http://localhost/');
    }

    return {
      method: event.httpMethod,
      path: cleanPath,
      url,
      headers: this.safeHeaders(event.headers),
      query,
      body,
      params: this.safeParams(event.pathParameters),
      cookies,
      event,
      context,
      isBase64Encoded: event.isBase64Encoded || false,
      requestId: context.awsRequestId,
      stage: event.requestContext?.stage || '$default',
      sourceIp: this.getSourceIp(event),
      userAgent: this.getUserAgent(event),
    };
  }

  static createResponseBody(response: any) {
    let body = response;
    if (response && typeof response === 'object') {
      if ('data' in response) {
        body = {
          data: response.data,
          timestamp: new Date().toISOString(),
        };
      } else if (response.body) {
        return response as LambdaResponse;
      } else {
        body = {
          data: response,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return body;
  }

  static toLambdaResponse(response: any, request?: LambdaRequest): LambdaResponse {
    let statusCode = response.status ?? 200;

    let body: any = this.createResponseBody(response);
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request?.requestId || 'unknown',
      'X-Powered-By': 'Lambda Decorators',
    };

    const cookies: string[] = [];

    if (response && typeof response === 'object') {
      if ('data' in response) {
        body = {
          success: OK_STATUSES.includes(statusCode),
          data: response.data,
          timestamp: new Date().toISOString(),
          requestId: request?.requestId,
        };
      } else if (response.body) {
        return response as LambdaResponse;
      } else {
        body = {
          success: OK_STATUSES.includes(statusCode),
          data: response,
          timestamp: new Date().toISOString(),
          requestId: request?.requestId,
        };
      }
    }
    let origin = LambdaAdapter.getHeaderValue(request?.headers, 'origin');
    const originHeader = Array.isArray(origin) ? origin[0] : origin;

    if (originHeader) {
      headers['Access-Control-Allow-Origin'] = originHeader;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
      headers['Access-Control-Allow-Headers'] =
        'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
    }

    if (request?.cookies && Object.keys(request.cookies).length > 0) {
      Object.entries(request.cookies).forEach(([name, value]) => {
        cookies.push(`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly`);
      });
    }

    const lambdaResponse: LambdaResponse = {
      statusCode,
      headers,
      body: JSON.stringify(body),
      isBase64Encoded: false,
    };

    if (cookies.length > 0) {
      lambdaResponse.cookies = cookies;
    }

    if (cookies.length > 0) {
      lambdaResponse.multiValueHeaders = {
        'Set-Cookie': cookies,
      };
    }

    return lambdaResponse;
  }

  static createHandler(Contoller: new (...args: any[]) => LambdaApp) {
    const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
      event,
      context,
    ) => {
      const instance = new Contoller() as Lambda;

      if (Object.hasOwn(instance, 'beforeStart')) {
        await instance.beforeStart?.();
      }

      try {
        const request = LambdaAdapter.toRequest(event, context);

        if (typeof instance.handleRequest === 'function') {
          const response = await instance.handleRequest(request);

          return LambdaAdapter.toLambdaResponse(response, request);
        } else {
          throw new Error('Controller must have handleRequest method');
        }
      } catch (error: any) {
        console.error('❌ Lambda error:', error);

        const errorResponse: any = {
          statusCode: error.status || 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': context.awsRequestId,
            'Access-Control-Allow-Origin': event.headers?.origin || event.headers?.Origin || '*',
            'Access-Control-Allow-Credentials': 'true',
          },
          body: JSON.stringify({
            success: false,
            message: error.message || 'Internal Server Error',
            requestId: context.awsRequestId,
          }),
        };

        if (error.cookies) {
          errorResponse.cookies = error.cookies;
        }

        return errorResponse;
      }
    };

    return handler;
  }

  private static safeHeaders(
    headers: APIGatewayProxyEventHeaders,
  ): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};

    if (!headers) return result;

    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }
    });

    return result;
  }

  private static safeParams(
    params: APIGatewayProxyEventPathParameters | null,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    if (!params) return result;

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }
    });

    return result;
  }

  private static getSourceIp(event: APIGatewayProxyEvent): string {
    if (event.requestContext?.identity?.sourceIp) {
      return event.requestContext.identity.sourceIp;
    }

    const forwardedFor: any = event.headers?.['x-forwarded-for'];
    if (forwardedFor) {
      if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
      }
      if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return forwardedFor[0].split(',')[0].trim();
      }
    }

    return '0.0.0.0';
  }

  private static getUserAgent(event: APIGatewayProxyEvent): string {
    const ua: any = event.headers?.['user-agent'];
    if (!ua) return 'unknown';

    if (typeof ua === 'string') return ua;
    if (Array.isArray(ua) && ua.length > 0) return ua[0];

    return 'unknown';
  }
}
