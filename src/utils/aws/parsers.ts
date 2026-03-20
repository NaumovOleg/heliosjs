import { NormalizedEvent } from '../../types/aws';

const parseLambdaQueryString = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {};
  if (!queryString) return params;

  new URLSearchParams(queryString).forEach((value, key) => {
    params[key] = value;
  });

  return params;
};
export const parseCloudFrontHeaders = (headers?: {
  [name: string]: Array<{
    key?: string | undefined;
    value: string;
  }>;
}): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};

  if (!headers) return result;

  Object.entries(headers).forEach(([key, values]) => {
    if (values.length > 1) {
      result[key] = values.map((v) => v.value);
    } else {
      result[key] = values[0]?.value || '';
    }
  });

  return result;
};

export const normalizeLambdaEvent = (event: any, type: string): NormalizedEvent => {
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
        queryStringParameters: parseLambdaQueryString(event.rawQueryString),
        pathParameters: {},
        cookies: [],
      };

    default:
      throw new Error(`Unsupported event type: ${type}`);
  }
};
