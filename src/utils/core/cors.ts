import { CORSConfig, Request, Response } from '../../types/core';
import { getOrigin } from './headers';

export function handleCORS(
  req: Request,
  res: Response,
  config: CORSConfig,
): { permitted: boolean; continue: boolean } {
  const origin = getOrigin(req);

  function isOriginAllowed(): boolean {
    if (!origin) return false;
    if (config.origin === '*') return true;
    if (typeof config.origin === 'string') return config.origin === origin;
    if (Array.isArray(config.origin)) return config.origin.includes(origin);
    if (typeof config.origin === 'function') return config.origin(origin);

    return false;
  }

  if (origin && !isOriginAllowed()) {
    res.status = 403;
    res.setHeader('Content-Type', 'application/json');

    return { permitted: false, continue: false };
  }

  if (req.method === 'OPTIONS') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (config.origin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    if (config.methods) {
      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
    }

    if (config.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
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
    res.setHeader('Access-Control-Allow-Origin', origin);

    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (config.exposedHeaders) {
      res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    }
  }

  return { permitted: true, continue: true };
}

export function isPreflightRequest(req: Request): boolean {
  return !!(
    req.method === 'OPTIONS' &&
    req.headers['access-control-request-method'] &&
    req.headers.origin
  );
}
