import { NormalizedEvent } from '@types';

export const getEventType = (event: any): 'rest' | 'http' | 'url' => {
  if (event.httpMethod && event.resource) {
    return 'rest';
  }
  if (event.version === '2.0' || event.requestContext?.http) {
    return 'http';
  }
  if (event.version && event.rawPath && !event.requestContext?.http) {
    return 'url';
  }
  return 'rest';
};

export const getSourceIp = (event: NormalizedEvent): string => {
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0].split(',')[0].trim();
    }
    return forwardedFor.split(',')[0].trim();
  }

  if (event.requestContext?.identity?.sourceIp) {
    return event.requestContext.identity.sourceIp;
  }

  if (event.requestContext?.http?.sourceIp) {
    return event.requestContext.http.sourceIp;
  }

  return '0.0.0.0';
};

const parseQueryString = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {};
  if (!queryString) return params;

  new URLSearchParams(queryString).forEach((value, key) => {
    params[key] = value;
  });

  return params;
};

export const normalizeEvent = (event: any, type: string): NormalizedEvent => {
  const base = {
    headers: event.headers || {},
    body: event.body || null,
    isBase64Encoded: event.isBase64Encoded || false,
    requestContext: event.requestContext,
  };

  switch (type) {
    case 'rest':
      return {
        ...base,
        httpMethod: event.httpMethod,
        path: event.path,
        queryStringParameters: event.queryStringParameters || {},
        multiValueQueryStringParameters: event.multiValueQueryStringParameters,
        pathParameters: event.pathParameters || {},
        cookies: event.headers?.Cookie ? [event.headers.Cookie] : [],
      };

    case 'http':
      return {
        ...base,
        httpMethod: event.requestContext?.http?.method || 'GET',
        path: event.rawPath,
        queryStringParameters: event.queryStringParameters || {},
        pathParameters: event.pathParameters || {},
        cookies: event.cookies || [],
      };

    case 'url':
      return {
        ...base,
        httpMethod: event.requestContext?.http?.method || 'GET',
        path: event.rawPath,
        queryStringParameters: parseQueryString(event.rawQueryString),
        pathParameters: {},
        cookies: [],
      };

    default:
      throw new Error(`Unsupported event type: ${type}`);
  }
};
