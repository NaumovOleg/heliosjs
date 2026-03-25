import {
  ALBEvent,
  ALBEventRequestContext,
  APIGatewayEventRequestContext,
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  CloudFrontEvent,
  CloudFrontRequestEvent,
  LambdaFunctionURLEvent,
} from 'aws-lambda';
import { LambdaEvent, NormalizedEvent, RequestContext } from '../../types/aws';

export const isRestApiEvent = (event: LambdaEvent): event is APIGatewayProxyEvent => {
  return (
    'httpMethod' in event &&
    event.httpMethod !== undefined &&
    'resource' in event &&
    event.resource !== undefined &&
    !('version' in event)
  );
};

export const isHttpApiEvent = (event: LambdaEvent): event is APIGatewayProxyEventV2 => {
  return (
    'version' in event &&
    event.version === '2.0' &&
    'requestContext' in event &&
    event.requestContext?.http !== undefined &&
    event.requestContext?.apiId !== undefined &&
    !event.requestContext?.domainName?.includes('lambda-url')
  );
};

export const getEventType = (event: LambdaEvent): 'rest' | 'http' | 'url' => {
  if (isRestApiEvent(event)) {
    return 'rest';
  }
  if (isHttpApiEvent(event)) {
    return 'http';
  }
  if (isLambdaUrlEvent(event)) {
    return 'url';
  }
  if ('httpMethod' in event && 'resource' in event) {
    return 'rest';
  }
  if ('version' in event && event.version === '2.0') {
    return 'http';
  }
  return 'rest';
};

export const isAPIGatewayV2Context = (
  ctx: RequestContext,
): ctx is APIGatewayEventRequestContextV2 => {
  return 'http' in ctx && 'apiId' in ctx;
};

export const isLambdaUrlContext = (ctx: RequestContext): ctx is APIGatewayEventRequestContextV2 => {
  return 'http' in ctx && ctx.domainName?.includes('lambda-url') === true;
};

export const isAPIGatewayV1Context = (
  ctx: RequestContext,
): ctx is APIGatewayEventRequestContext => {
  return 'identity' in ctx && 'httpMethod' in ctx;
};

export const isALBContext = (ctx: RequestContext): ctx is ALBEventRequestContext => {
  return 'elb' in ctx;
};

export const isCloudFrontContext = (ctx: RequestContext): ctx is CloudFrontEvent['config'] => {
  return 'distributionId' in ctx;
};

export const isAPIGatewayV1Event = (event: LambdaEvent): event is APIGatewayProxyEvent => {
  return (
    'requestContext' in event &&
    'apiId' in event.requestContext &&
    event.requestContext.apiId !== undefined &&
    'httpMethod' in event &&
    event.httpMethod !== undefined &&
    !('version' in event)
  );
};

export const isAPIGatewayV2Event = (event: LambdaEvent): event is APIGatewayProxyEventV2 => {
  return (
    'version' in event &&
    event.version === '2.0' &&
    'requestContext' in event &&
    event.requestContext?.apiId !== undefined &&
    event.requestContext?.http !== undefined &&
    !event.requestContext?.domainName?.includes('lambda-url') // не lambda-url
  );
};

export const isLambdaUrlEvent = (event: LambdaEvent): event is LambdaFunctionURLEvent => {
  return (
    'version' in event &&
    event.version === '2.0' &&
    'rawPath' in event &&
    'requestContext' in event &&
    event.requestContext?.http !== undefined &&
    event.requestContext?.domainName?.includes('lambda-url') === true
  );
};

export const isALBEvent = (event: LambdaEvent): event is ALBEvent => {
  return 'requestContext' in event && (event as ALBEvent).requestContext?.elb !== undefined;
};

export const isCloudFrontEvent = (event: LambdaEvent): event is CloudFrontRequestEvent => {
  return (
    'Records' in event &&
    Array.isArray(event.Records) &&
    event.Records.length > 0 &&
    event.Records[0]?.cf !== undefined
  );
};

export const getSourceIp = (event: NormalizedEvent): string => {
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0].split(',')[0].trim();
    }
    return forwardedFor.split(',')[0].trim();
  }

  const ctx = event.requestContext;

  if (isAPIGatewayV2Context(ctx) || isLambdaUrlContext(ctx)) {
    return ctx.http.sourceIp;
  }

  if (isAPIGatewayV1Context(ctx)) {
    return ctx.identity.sourceIp;
  }

  if (isCloudFrontContext(ctx)) {
    const cfForwardedFor = event.headers['x-forwarded-for'];
    if (cfForwardedFor) {
      return Array.isArray(cfForwardedFor) ? cfForwardedFor[0] : cfForwardedFor;
    }
  }

  return '0.0.0.0';
};

export const getQueryStringParameters = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | ALBEvent,
) => {
  const query: Record<string, string> = {};
  Object.entries(event.queryStringParameters ?? {}).forEach(([key, value]) => {
    query[key] = (value as string) || '';
  });

  return query;
};

export const getMultiValueQueryStringParameters = (event: APIGatewayProxyEvent | ALBEvent) => {
  const query: Record<string, string[]> = {};

  Object.entries(event.multiValueQueryStringParameters ?? {}).forEach(([key, value]) => {
    query[key] = value as string[];
  });

  return query;
};
