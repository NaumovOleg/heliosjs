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
  static async create(
    req: IncomingMessage,
    maxBytes?: number,
    trustProxy = false
  ): Promise<Req> {
    const fwdProto = trustProxy ? req.headers['x-forwarded-proto'] : undefined;
    const protoStr = Array.isArray(fwdProto) ? fwdProto[0] : fwdProto;
    const protocolStr = protoStr && ['http', 'https'].includes(protoStr) ? protoStr : 'http';
    const host = req.headers.host || 'localhost';
    const fullUrl = `${protocolStr}://${host}${req.url}`;
    const requestUrl = new URL(fullUrl);
    const cookies = parseRequestCookie(req.headers?.cookie);
    const query = parseQuery(requestUrl);

    // Direct socket address; `req.getClientIp()` applies X-Forwarded-For itself
    // when `trustProxy` is on.
    const sourceIp = req.socket.remoteAddress ?? '0.0.0.0';

    const method = req.method || 'GET';
    let rawBody: Buffer | undefined;
    let body: unknown;

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      rawBody = await collectRawBody(req, maxBytes);
      body = parseBody({
        body: rawBody,
        headers: req.headers as Record<string, string | string[]>,
        isBase64Encoded: false,
      });
      Object.assign(req, { body });
    }

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
      trustProxy,
      isBase64Encoded: false,
    });
  }
}
