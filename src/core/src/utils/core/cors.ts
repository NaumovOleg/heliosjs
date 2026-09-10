import type { CORSConfig, Request, Response } from '../../types/core';
import { getHeaderCI, getOrigin } from './headers';

function setOriginHeader(res: Response, config: CORSConfig, origin: string) {
  const effectiveOrigin = config.origin ?? '*';
  if (effectiveOrigin === '*') {
    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
}

/**
 * @internal Applies a {@link CORSConfig} to one request/response pair — sets the
 * `Access-Control-*` headers and decides whether the request may proceed. Used
 * by the `@Cors` decorator's compiled middleware and the global `cors` config;
 * app code configures CORS declaratively instead of calling this directly.
 *
 * @param req - The incoming request (read for `Origin` and preflight headers).
 * @param res - The response to set CORS headers on.
 * @param config - The policy to apply.
 * @returns `permitted: false` when the origin is disallowed (caller should 403);
 *   `continue: false` on a handled preflight (caller should respond immediately
 *   with the set status, no further pipeline); `continue: true` for a normal
 *   request to keep processing.
 */
export function handleCORS(
  req: Request,
  res: Response,
  config: CORSConfig,
): { permitted: boolean; continue: boolean } {
  const origin = getOrigin(req);
  const effectiveOrigin = config.origin ?? '*';

  function isOriginAllowed(): boolean {
    if (!origin) return true;
    if (effectiveOrigin === '*') return true;
    if (typeof effectiveOrigin === 'string') return effectiveOrigin === origin;
    if (Array.isArray(effectiveOrigin)) return effectiveOrigin.includes(origin);
    if (typeof effectiveOrigin === 'function') return effectiveOrigin(origin);

    return false;
  }

  if (origin && !isOriginAllowed()) {
    res.status = 403;
    res.setHeader('Content-Type', 'application/json');

    return { permitted: false, continue: false };
  }

  const isPreflight =
    req.method === 'OPTIONS' &&
    !!getHeaderCI(req.headers, 'access-control-request-method') &&
    origin;
  if (isPreflight) {
    setOriginHeader(res, config, origin ?? '*');
    if (config.methods) {
      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
    }
    const requestedHeaders = getHeaderCI(req.headers, 'access-control-request-headers');

    if (config.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    } else if (requestedHeaders) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        Array.isArray(requestedHeaders) ? requestedHeaders.join(', ') : requestedHeaders
      );
    }
    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (config.maxAge) {
      res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
    }

    res.status = config.optionsSuccessStatus || 204;

    return { permitted: true, continue: false };
  }
  if (origin) {
    setOriginHeader(res, config, origin);

    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (config.exposedHeaders) {
      res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    }
  }

  return { permitted: true, continue: true };
}
