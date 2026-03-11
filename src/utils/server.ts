import { CATCH, INTECEPT, SERVER_CONFIG_KEY, SERVER_MODULES_KEY, USE_MIDDLEWARE } from '@constants';
import { ServerConfig } from '@types';
import http from 'http';

export const resolveConfig = (configOrClass?: any): ServerConfig => {
  let config: ServerConfig = {};

  if (configOrClass && typeof configOrClass === 'function') {
    const decoratorConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, configOrClass) || {};
    const controllers = Reflect.getMetadata(SERVER_MODULES_KEY, configOrClass) || [];
    const errorHandler = Reflect.getMetadata(CATCH, configOrClass);
    const interceptors = Reflect.getMetadata(INTECEPT, configOrClass);
    const middlewares = Reflect.getMetadata(USE_MIDDLEWARE, configOrClass);

    config = {
      port: 3000,
      host: 'localhost',
      ...decoratorConfig,
      errorHandler: decoratorConfig.errorHandler ?? errorHandler,
      interceptors,
      middlewares: decoratorConfig.middlewares.concat(middlewares),
      cors: decoratorConfig.cors,
      controllers: [...controllers, ...(decoratorConfig.controllers || [])],
    };
  } else if (configOrClass && typeof configOrClass === 'object') {
    config = { port: 3000, host: 'localhost', ...configOrClass };
  } else {
    config = {
      port: 3000,
      host: 'localhost',
      controllers: [],
    };
    console.log('⚙️ Using default configuration');
  }

  return config;
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
