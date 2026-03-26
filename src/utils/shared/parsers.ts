export const parseQuery = (url: URL) => {
  const params = url.searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);

    query[key] = values.length > 1 ? values : values[0];
  }

  return query;
};

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
  const getString = (data: unknown): string => {
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
    } catch (_: unknown) {
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
    } catch (_: unknown) {
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

const parseCookie = (cookies: string) => {
  return (cookies as string).split(';').reduce(
    (acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        acc[name] = decodeURIComponent(value);
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

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
 * Safely convert headers to Record<string, string | string[]>
 */
export const parseHeaders = (
  headers?: Record<string, string | undefined>,
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
