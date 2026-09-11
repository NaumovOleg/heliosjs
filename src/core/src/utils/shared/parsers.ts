import { ErrorCode } from '../../types/core/error';
import { BaseError } from '../core/error/base';

/** @internal Parses a URL's query string into `Record<string, string | string[]>` (repeated keys become arrays). */
export const parseQuery = (url: URL) => {
  const params = url.searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);

    query[key] = values.length > 1 ? values : values[0];
  }

  return query;
};

/**
 * @internal Decodes a raw request body per its `Content-Type`: JSON parsed to an
 * object (throws `BaseError`/400 on malformed JSON), `text/*` and XML to a
 * string, form-urlencoded to a key/value map, multipart left as a marker object
 * for `MultipartProcessor`, everything else returned as-is (Buffer decoded to
 * utf8 string as a last resort). A no-op when `body` is already a non-Buffer
 * object.
 */
export const parseBody = (request: {
  body: unknown;
  headers: Record<string, string | string[]>;
  isBase64Encoded?: boolean;
}) => {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  const { body, headers, isBase64Encoded } = request;

  if (!body) {
    return;
  }

  const processedBody = body;

  let contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
  if (Array.isArray(contentType)) {
    contentType = contentType[0];
  }

  const cleanContentType = contentType.split(';')[0].trim().toLowerCase();
  const getString = (data: unknown): string => {
    let str;

    if (isBase64Encoded) {
      str = Buffer.from(String(data), 'base64').toString('utf8');
    } else if (Buffer.isBuffer(data)) {
      str = data.toString('utf8');
    } else {
      str = String(data);
    }

    // eslint-disable-next-line no-control-regex
    str = str.replace(/[\0\x08\x0E-\x1F]/g, '');
    if (str.charCodeAt(0) === 0xfeff) {
      str = str.slice(1);
    }
    return str.trim();
  };

  if (cleanContentType === 'application/json') {
    const str = getString(processedBody);
    if (str === '') return undefined;
    try {
      return JSON.parse(str);
    } catch {
      throw new BaseError(ErrorCode.BAD_REQUEST, 'Invalid JSON body', { status: 400 });
    }
  }
  if (cleanContentType.startsWith('text/')) {
    return getString(processedBody);
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
    } catch {
      return { raw: getString(processedBody) };
    }
  }

  if (cleanContentType === 'application/xml' || cleanContentType === 'text/xml') {
    return getString(processedBody);
  }

  if (cleanContentType.startsWith('multipart/')) {
    return {
      multipart: true,
      contentType,
      body: processedBody,
    };
  }

  if (Buffer.isBuffer(processedBody)) {
    return processedBody.toString('utf8');
  }

  return processedBody;
};

const parseCookie = (cookies: string) => {
  return (cookies as string).split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      acc[name] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);
};

/** @internal Parses one or more `Cookie` header values into a `name -> value` map. */
export const parseRequestCookie = (cookies?: string | string[]): Record<string, string> => {
  if (!cookies) return {};

  const values = Array.isArray(cookies) ? cookies : [cookies];
  return values.reduce((acc, cookie) => {
    return {
      ...acc,
      ...parseCookie(cookie),
    };
  }, {});
};

/**
 * @internal Safely converts a headers object (values possibly `undefined`) to
 * `Record<string, string | string[]>`, dropping `undefined` entries.
 */
export const parseHeaders = (
  headers?: Record<string, string | undefined>
): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};

  if (!headers) return result;

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });

  return result;
};
