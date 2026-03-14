import { CORS_METADATA } from '@constants';
import { ControllerClass, ILambdaAdapter, LambdaEvent, LambdaPlugin } from '@types';
import { getErrorType, handleCORS, serializeError } from '@utils';
import { APIGatewayProxyResult, APIGatewayProxyResultV2, Context, Handler } from 'aws-lambda';
import { Plugin } from '../plugin';
import { LRequest, LResponse, getEventType } from './utils';

export class LambdaAdapter extends Plugin implements ILambdaAdapter {
  handler: Handler;
  controllers: ControllerClass[] = [];
  plugins: LambdaPlugin[] = [];
  constructor(Controller: ControllerClass) {
    super();
    this.controllers.push(Controller);
    this.handler = this.createHandler(Controller);
  }

  private createHandler(Controller: ControllerClass): Handler {
    return async (event: LambdaEvent, context: Context) => {
      this.controllers.push(Controller);

      await this.callPluginHook('beforeRequest', event, context);

      const eventType = getEventType(event);

      const request = new LRequest(event, context);
      const response = new LResponse();
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
    request: LRequest;
    response: LResponse;
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

        if (processed.routeMatch) break;
      } catch (error: any) {
        return this.handleError(error, event, context);
      }
    }

    if (!processed?.routeMatch) {
      response.statusCode = 404;
      return this.toLambdaResponse({ data: 'Route not found' }, request, response, eventType);
    }

    if (getErrorType(processed?.data).isError) {
      return this.handleError(processed?.data, event, context);
    }

    return this.toLambdaResponse(processed?.data, request, response, eventType);
  }

  private toLambdaResponse(
    data: any,
    request: LRequest,
    response: LResponse,
    eventType: string,
  ): APIGatewayProxyResult | APIGatewayProxyResultV2 | any {
    const statusCode = data.status ?? response.statusCode ?? 200;
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
        return {
          statusCode,
          headers,
          body,
        };
    }
  }

  private handleError(error: any, event: LambdaEvent, context: Context) {
    let serialized = serializeError(error);

    const eventType = getEventType(event);

    const statusCode = serialized.status || 500;

    const body = JSON.stringify({
      success: false,
      message: serialized.message || 'Internal Server Error',
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
        return { statusCode, headers, body, isBase64Encoded: false };
      default:
        return { statusCode, headers, body };
    }
  }
}
