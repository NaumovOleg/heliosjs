import type { IncomingMessage } from 'node:http';
import type { IRequestFactory } from '@heliosjs/core/types';
import {
  generateFastRequestId,
  parseBody,
  parseQuery,
  parseRequestCookie,
  Req,
} from '@heliosjs/core/utils';
import { collectRawBody } from './body';

const DEFAULT_REQUEST_BODY_LIMIT = 1_048_576;

export class RequestFactory {
  /**
   * Create Request from HTTP IncomingMessage
   */
  static async create(
    req: IncomingMessage,
    maxBytes?: number,
    trustProxy = false,
    skipBody = false,
    canonicalHost?: string
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
    const effectiveMaxBytes = maxBytes ?? DEFAULT_REQUEST_BODY_LIMIT;
    let rawBody: Buffer | undefined;
    let body: unknown;

    const carriesBody = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (carriesBody) {
      rawBody = await collectRawBody(req, effectiveMaxBytes);
      body = parseBody({
        body: rawBody,
        headers: req.headers as Record<string, string | string[]>,
        isBase64Encoded: false,
      });
      // GraphQL/Yoga receives the original IncomingMessage. Attach the
      // bounded bytes so @whatwg-node/server uses them as BodyInit instead of
      // trying to read the already-consumed stream a second time.
      Object.assign(req, skipBody ? { body: rawBody } : { body });
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
      requestId: generateFastRequestId(),
      stage: 'http',
      timestamp: new Date(),
      raw: req,
      context: req.socket,
      rawBody,
      trustProxy,
      canonicalHost,
      isBase64Encoded: false,
    });
  }
}

// Compile-time-only check that RequestFactory's static side conforms to the
// shared IRequestFactory contract (see its doc comment in @heliosjs/core) —
// `implements` doesn't reach static members, so this is the idiom instead.
// Unused-by-design (prefixed `_` per this repo's convention for that).
const _requestFactoryShape: IRequestFactory<Parameters<typeof RequestFactory.create>> =
  RequestFactory;
