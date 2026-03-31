import { CORS_METADATA } from './constants';
import { ILambdaAdapter, LambdaEvent, Plugin as LambdaPlugin } from './types/aws';

import {
  ALBResult,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Context,
  Handler,
} from 'aws-lambda';
import { ControllerClass, ErrorObject, Request, Response } from './types/core';
import { getEventType, Plugin, RequestFactory, ResponseFactory } from './utils/aws';
import { ApplicationError, getErrorType, handleCORS } from './utils/core';

export class Helios extends Plugin implements ILambdaAdapter {
  handler: Handler;
  controllers: ControllerClass[] = [];
  plugins: LambdaPlugin[] = [];
  constructor(Controller: ControllerClass) {
    super();

    this.controllers.push(Controller);
    this.handler = this.createHandler();
  }

  private createHandler(): Handler {
    return async (event: LambdaEvent, context: Context) => {
      await this.callPluginHook('beforeRequest', event, context);

      const eventType = getEventType(event);
      const request = RequestFactory.create(event, context);
      const response = ResponseFactory.create(request);

      return this.runControllers({
        context,
        event,
        eventType,
        request,
        response,
      });
    };
  }

  private async runControllers(meta: {
    request: Request;
    response: Response;
    eventType: 'rest' | 'http' | 'url';
    event: LambdaEvent;
    context: Context;
  }) {
    const { request, response, eventType } = meta;
    let processed;

    for (const ControllerClass of this.controllers ?? []) {
      const instance = new ControllerClass();

      try {
        const cors = Reflect.getMetadata(CORS_METADATA, instance);

        let handledCors = { permitted: true, continue: true };
        if (cors) {
          handledCors = handleCORS(request, response, cors);
        }

        if (!handledCors.permitted) {
          meta.response.status = 403;
          meta.response.data = { message: 'Cors: Origin not allowed' };
          return this.toLambdaResponse(request, response, eventType);
        }

        if (!handledCors.continue && handledCors.permitted) {
          response.status = 204;
          return this.toLambdaResponse(request, response, eventType);
        }
        if (typeof instance.handleRequest !== 'function') {
          throw new TypeError('Controller must have handleRequest method');
        }

        await this.callPluginHook('beforeRoute', request, response);

        processed = await instance.handleRequest(request, response);

        if (processed) break;
      } catch (error: unknown) {
        return this.handleError(error as ErrorObject, request);
      }
    }

    if (getErrorType(response?.data).isError) {
      return this.handleError(processed?.data, request);
    }

    return this.toLambdaResponse(request, response, eventType);
  }

  private toLambdaResponse(
    request: Request,
    response: Response,
    eventType: string,
  ): APIGatewayProxyResult | APIGatewayProxyResultV2 | ALBResult {
    const statusCode = response.data?.status ?? response?.status ?? 200;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request.requestId,
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
      data: response?.data,
      timestamp: new Date().toISOString(),
    });

    const commonResponse = {
      statusCode,
      headers,
      body: response?.data,
      timestamp: new Date().toISOString(),
    };

    this.callPluginHook('afterResponse', request, response);
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
        return { statusCode, headers, body };
    }
  }

  private handleError(error: ErrorObject, request: Request) {
    const config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
    };

    const serialized = new ApplicationError(error, {
      meta: request,
      config,
    });

    const statusCode = serialized.status || 500;
    const body = JSON.stringify(serialized);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request.requestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    return { statusCode, headers, body, isBase64Encoded: false };
  }
}
