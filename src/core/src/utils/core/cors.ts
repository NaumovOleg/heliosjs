import { CORSConfig, Request, Response } from '../../types/core';
import { getOrigin } from './headers';

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
    req.method === 'OPTIONS' && req.headers['access-control-request-method'] && origin;
  if (isPreflight) {
    setOriginHeader(res, config, origin ?? '*');
    if (config.methods) {
      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
    }
    const requestedHeaders = req.headers['access-control-request-headers'];

    if (config.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    } else if (requestedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
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
