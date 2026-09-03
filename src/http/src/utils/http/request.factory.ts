import type { IncomingMessage } from 'node:http';
import {
  generateUniqueId,
  parseBody,
  parseQuery,
  parseRequestCookie,
  Req,
} from '@heliosjs/core/utils';
import { collectRawBody } from './body';

export class RequestFactory {
  /**
   * Create Request from HTTP IncomingMessage
   */
  static async create(req: IncomingMessage, maxBytes?: number): Promise<Req> {
    const protocol = req.headers['x-forwarded-proto'];
    const protoStr = Array.isArray(protocol) ? protocol[0] : protocol;
    const protocolStr = protoStr && ['http', 'https'].includes(protoStr) ? protoStr : 'http';
    const host = req.headers.host || 'localhost';
    const fullUrl = `${protocolStr}://${host}${req.url}`;
    const requestUrl = new URL(fullUrl);
    const cookies = parseRequestCookie(req.headers?.cookie);
    const query = parseQuery(requestUrl);

    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const sourceIp =
      forwardedFor?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '0.0.0.0';

    const rawBody = await collectRawBody(req, maxBytes);

    const body = parseBody({
      body: rawBody,
      headers: req.headers as Record<string, string | string[]>,
      isBase64Encoded: false,
    });

    Object.assign(req, { body });

    return new Req({
      url: req.url ?? '/',
      requestUrl,
      source: 'http',
      method: req.method || 'GET',
      path: requestUrl.pathname || '/',
      headers: req.headers as Record<string, string | string[]>,
      query,
      body,
      params: {},
      cookies,
      sourceIp,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      requestId: generateUniqueId(),
      stage: 'http',
      timestamp: new Date(),
      raw: req,
      context: req.socket,
      rawBody,
      isBase64Encoded: false,
    });
  }
}
