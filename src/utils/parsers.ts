import { NormalizedEvent } from '@types';
import http from 'http';
export const ParseQuery = (url: URL) => {
  const params = url.searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);

    query[key] = values.length > 1 ? values : values[0];
  }

  return query;
};

export const parceBody = (request: any): any => {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  const { body, headers, isBase64Encoded } = request;

  if (!body) {
    return {};
  }

  let processedBody = body;
  if (isBase64Encoded && typeof body === 'string') {
    try {
      processedBody = Buffer.from(body, 'base64');
    } catch (error) {
      console.error('Failed to decode base64 body:', error);
    }
  }
  let contentType = headers['content-type'] ?? headers['Content-Type'] ?? '';
  if (Array.isArray(contentType)) {
    contentType = contentType[0];
  }

  const cleanContentType = contentType.split(';')[0].trim().toLowerCase();
  const getString = (data: any): string => {
    if (Buffer.isBuffer(data)) {
      return data.toString('utf8');
    }
    if (typeof data === 'string') {
      return data;
    }
    return String(data);
  };

  if (cleanContentType === 'application/json') {
    try {
      const str = getString(processedBody);
      return JSON.parse(str);
    } catch (error) {
      return { text: getString(processedBody), parseError: true };
    }
  }
  if (cleanContentType.startsWith('text/')) {
    return { text: getString(processedBody) };
  }

  if (cleanContentType === 'application/x-www-form-urlencoded') {
    try {
      const text = getString(processedBody);
      const params = new URLSearchParams(text);
      const result: Record<string, string | string[]> = {};
      for (const [key, value] of params.entries()) {
        if (result[key] !== undefined) {
          if (Array.isArray(result[key])) {
            (result[key] as string[]).push(value);
          } else {
            result[key] = [result[key] as string, value];
          }
        } else {
          result[key] = value;
        }
      }
      return result;
    } catch (error) {
      return { raw: getString(processedBody) };
    }
  }

  if (cleanContentType === 'application/xml' || cleanContentType === 'text/xml') {
    return { xml: getString(processedBody) };
  }

  if (cleanContentType.startsWith('multipart/')) {
    return {
      multipart: true,
      contentType,
      body: processedBody,
    };
  }

  if (Buffer.isBuffer(processedBody)) {
    return { raw: processedBody.toString('utf8') };
  }

  return processedBody;
};

export const ParseCookies = (req: http.IncomingMessage): Record<string, string> => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce(
    (cookies, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
      return cookies;
    },
    {} as Record<string, string>,
  );
};

const parseLambdaQueryString = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {};
  if (!queryString) return params;

  new URLSearchParams(queryString).forEach((value, key) => {
    params[key] = value;
  });

  return params;
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
