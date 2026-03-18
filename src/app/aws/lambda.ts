import { CORS_METADATA } from '@constants';
import {
  ControllerClass,
  ILambdaAdapter,
  IRequest,
  IResponse,
  LambdaEvent,
  LambdaPlugin,
} from '@types';
import {
  ApplicationError,
  getErrorType,
  getEventType,
  handleCORS,
  RequestFactory,
  ResponseFactory,
} from '@utils';
import { APIGatewayProxyResult, APIGatewayProxyResultV2, Context, Handler } from 'aws-lambda';
import { Plugin } from '../plugin';

export class LambdaAdapter extends Plugin implements ILambdaAdapter {
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
      const request = RequestFactory.fromLambda(event, context);

      const response = ResponseFactory.forLambda(request);

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
    request: IRequest;
    response: IResponse;
    eventType: 'rest' | 'http' | 'url';
    event: LambdaEvent;
    context: Context;
  }): Promise<any> {
    const { request, response, eventType, event, context } = meta;
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

        await this.callPluginHook('beforeRoute', request, response);

        processed = await instance.handleRequest(request, response);

        if (processed) break;
      } catch (error: any) {
        return this.handleError(error, request);
      }
    }

    if (getErrorType(response?.data).isError) {
      return this.handleError(processed?.data, request);
    }

    return this.toLambdaResponse(processed?.data, request, response, eventType);
  }

  private toLambdaResponse(
    data: any | undefined | null,
    request: IRequest,
    response: IResponse,
    eventType: string,
  ): APIGatewayProxyResult | APIGatewayProxyResultV2 | any {
    const statusCode = data?.status ?? response?.status ?? 200;
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
      data: data?.data ?? data?.error ?? data,
      timestamp: new Date().toISOString(),
    });

    const commonResponse = {
      statusCode,
      headers,
      body: data?.data ?? data?.error ?? data,
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

  private handleError(error: any, request: IRequest) {
    const config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
    };

    let serialized = new ApplicationError(error, {
      meta: request,
      config,
    });
    const eventType = getEventType(request.getLambdaEvent());
    const statusCode = serialized.status || 500;
    const body = JSON.stringify(serialized);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request.requestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    switch (eventType) {
      case 'rest':
        return { statusCode, headers, body, isBase64Encoded: false };
      default:
        return { statusCode, headers, body };
    }
  }
}
