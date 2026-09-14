import type { HTTP_METHODS, RequestOptions } from '@heliosjs/core/types';
import { parseBody, parseHeaders, parseQuery, parseRequestCookie } from '@heliosjs/core/utils';
import type { HttpRequest, InvocationContext } from '@azure/functions';

/**
 * The Functions host sets `X-Forwarded-For` as `ip:port` (comma-separated for
 * multiple hops). The right-most entry is the one appended by Azure's own
 * front end — the only trusted hop — so take that one and strip the port. A
 * client can prepend arbitrary values, making the left-most entry spoofable.
 */
const getSourceIp = (headers: Record<string, string | string[]>): string | undefined => {
  const forwardedFor = headers['x-forwarded-for'];
  const value = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const entries = value?.split(',');
  return entries?.[entries.length - 1]?.trim().replace(/:\d+$/, '');
};

/**
 * Normalizes an Azure Functions v4 `HttpRequest` into the core
 * {@link RequestOptions}. Unlike AWS, Azure Functions has exactly one HTTP
 * request shape regardless of trigger — no per-source dispatch needed.
 */
export const normalizeAzureRequest = async (
  req: HttpRequest,
  context: InvocationContext
): Promise<RequestOptions> => {
  const rawHeaders: Record<string, string> = {};
  for (const [key, value] of req.headers) rawHeaders[key] = value;
  const headers = parseHeaders(rawHeaders);

  const requestUrl = new URL(req.url);
  const rawBody = Buffer.from(await req.arrayBuffer());
  const body = parseBody({ headers, body: rawBody.length ? rawBody : undefined });

  return {
    requestId: context.invocationId,
    method: req.method as HTTP_METHODS,
    url: req.url,
    requestUrl,
    path: requestUrl.pathname,
    headers,
    query: parseQuery(requestUrl),
    params: { ...req.params },
    cookies: parseRequestCookie(headers.cookie),
    rawBody,
    body,
    source: 'azure',
    timestamp: new Date(),
    context,
    event: req,
    sourceIp: getSourceIp(headers),
    userAgent: typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined,
  };
};
