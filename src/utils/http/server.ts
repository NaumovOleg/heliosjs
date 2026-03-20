import { CATCH, INTECEPT, SANITIZE, SERVER_CONFIG_KEY, USE_MIDDLEWARE } from '@constants';
import http from 'http';
import { ServerConfig } from '../../types/http';

/**
 * Resolves the server configuration from a class or an object.
 *
 * @param configOrClass - Can be a class with decorators or a plain configuration object.
 *
 * @returns A complete ServerConfig object with defaults and merged properties.
 *
 * Behavior:
 * - If a class is provided, extracts metadata from decorators to build the config.
 * - If an object is provided, merges it with default values.
 * - Defaults: port = 3000, host = 'localhost'.
 * - Merges middleware, interceptors, errorHandler, cors, controllers, sanitizers from decorators or object.
 */
export const resolveConfig = (configOrClass?: any): ServerConfig => {
  if (!configOrClass || typeof configOrClass !== 'function') {
    throw 'Invalid root controller';
  }
  const decoratorConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, configOrClass) || {};
  const errorHandler = Reflect.getMetadata(CATCH, configOrClass);
  const interceptors = Reflect.getMetadata(INTECEPT, configOrClass);
  const middlewares = Reflect.getMetadata(USE_MIDDLEWARE, configOrClass);
  const sanitizers = Reflect.getMetadata(SANITIZE, configOrClass.prototype) || [];

  return {
    port: 3000,
    host: 'localhost',
    ...decoratorConfig,
    errorHandler: decoratorConfig.errorHandler ?? errorHandler,
    interceptors: (interceptors ?? []).filter((el: any) => !!el),
    middlewares: decoratorConfig.middlewares.concat(middlewares).filter((el: any) => !!el) ?? [],
    cors: decoratorConfig.cors,
    controllers: (decoratorConfig.controllers ?? []).filter((el: any) => !!el),
    sanitizers,
    websocketPath: decoratorConfig.websocketPath ?? '/ws',
  };
};

export const collectRawBody = (req: http.IncomingMessage): Promise<Buffer> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });

    req.on('error', () => {
      resolve(Buffer.from(''));
    });
  });
};
