import { CORS_METADATA } from '../../constants';
import { CORSConfig, Request } from '../../types/core';
import { getOrigin } from './headers';

export function handleCORS(
  req: Request,
  res: any,
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
    res.statusCode = 403;
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

    res.statusCode = config.optionsSuccessStatus || 204;
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

export function isPreflightRequest(req: any): boolean {
  return (
    req.method === 'OPTIONS' && req.headers['access-control-request-method'] && req.headers.origin
  );
}

export const getCORSConfig = (controller: any, methodName?: string): CORSConfig | null => {
  if (methodName) {
    const methodConfig = Reflect.getMetadata(CORS_METADATA, controller, methodName);
    if (methodConfig) {
      return methodConfig;
    }
  }

  if (controller && controller.constructor) {
    const classConfig = Reflect.getMetadata(CORS_METADATA, controller.constructor.prototype);
    if (classConfig) {
      return classConfig;
    }
  }

  return null;
};

export const getCORSHeaders = (req: any, config: CORSConfig): Record<string, string> => {
  const headers: Record<string, string> = {};
  const origin = req?.headers?.origin || req?.headers?.Origin;

  if (!origin) return headers;

  let allowedOrigin: string | null = null;

  if (config.origin === '*') {
    allowedOrigin = '*';
  } else if (typeof config.origin === 'string') {
    allowedOrigin = config.origin;
  } else if (Array.isArray(config.origin)) {
    if (config.origin.includes(origin)) {
      allowedOrigin = origin;
    }
  } else if (typeof config.origin === 'function') {
    if (config.origin(origin)) {
      allowedOrigin = origin;
    }
  } else if (config.origin === true) {
    allowedOrigin = origin;
  }

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;

    if (config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (config.exposedHeaders?.length) {
      headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
    }

    if (req.method === 'OPTIONS') {
      if (config.methods?.length) {
        headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
      }
      if (config.allowedHeaders?.length) {
        headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
      }
      if (config.maxAge) {
        headers['Access-Control-Max-Age'] = config.maxAge.toString();
      }
    }
  }

  return headers;
};
