import { CORS_METADATA } from '@constants';
import { LambdaApp, LambdaEvent } from '@types';
import { handleCORS } from '@utils';
import { APIGatewayProxyResult, APIGatewayProxyResultV2, Context, Handler } from 'aws-lambda';
import { LRequest, LResponse, getEventType } from './utils';

export class LambdaAdapter {
  static createHandler(Controller: new (...args: any[]) => LambdaApp): Handler {
    return async (event: LambdaEvent, context: Context) => {
      const instance: any = new Controller();

      if (Object.hasOwn(instance, 'beforeStart')) {
        await instance.beforeStart?.();
      }

      const eventType = getEventType(event);

      try {
        const cors = Reflect.getMetadata(CORS_METADATA, instance);

        const request = new LRequest(event, context);
        const response = new LResponse();

        let handledCors = { permitted: true, continue: true };
        if (cors) {
          handledCors = handleCORS(request, response, cors);
        }

        if (!handledCors.permitted) {
          return this.toLambdaResponse(
            { status: 403, message: 'Cors: Origin not allowed' },
            request,
            response,
            eventType,
          );
        }
        if (!handledCors.continue && handledCors.permitted) {
          return this.toLambdaResponse({ status: 204 }, request, response, eventType);
        }
        if (typeof instance.handleRequest !== 'function') {
          throw new Error('Controller must have handleRequest method');
        }

        const data = await instance.handleRequest(request, response);

        return this.toLambdaResponse(data, request, response, eventType);
      } catch (error: any) {
        return this.handleError(error, event, context);
      }
    };
  }

  private static toLambdaResponse(
    data: any,
    request: LRequest,
    response: LResponse,
    eventType: string,
  ): APIGatewayProxyResult | APIGatewayProxyResultV2 | any {
    const statusCode = data.status || 200;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request.requestId,
      ...(data.headers || {}),
      ...response.headers,
    };

    const originHeader = request.headers['origin'] || request.headers['Origin'];
    let origin: string | undefined;

    if (originHeader) {
      if (Array.isArray(originHeader)) {
        origin = originHeader[0];
      } else {
        origin = originHeader;
      }
    }

    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
      headers['Access-Control-Allow-Headers'] =
        'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
    }

    const body = JSON.stringify({
      success: statusCode < 400,
      data: data.data ?? data.error,
      timestamp: new Date().toISOString(),
    });

    const commonResponse = {
      statusCode,
      headers,
      body: data.data ?? data.error,
      timestamp: new Date().toISOString(),
    };

    switch (eventType) {
      case 'rest':
        return { ...commonResponse, isBase64Encoded: false };

      case 'http':
        return {
          ...commonResponse,
          cookies: request.cookies
            ? Object.entries(request.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            : undefined,
        };

      case 'url':
        return {
          ...commonResponse,
          cookies: request.cookies
            ? Object.entries(request.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            : undefined,
        };

      default:
        return {
          statusCode,
          headers,
          body,
        };
    }
  }

  private static handleError(error: any, event: LambdaEvent, context: Context) {
    const eventType = getEventType(event);
    const statusCode = error.status || 500;

    const body = JSON.stringify({
      success: false,
      message: error.message || 'Internal Server Error',
      requestId: context.awsRequestId,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': context.awsRequestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    switch (eventType) {
      case 'rest':
        return {
          statusCode,
          headers,
          body,
          isBase64Encoded: false,
        };
      default:
        return {
          statusCode,
          headers,
          body,
        };
    }
  }
}
