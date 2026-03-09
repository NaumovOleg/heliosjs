import { SERVER_CONFIG_KEY, SERVER_MODULES_KEY } from '@constants';
import { Conf } from '@types';

export function Server(config: Conf = {}) {
  return function (target: any) {
    const existingConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, target) || {};

    const mergedConfig = {
      ...existingConfig,
      ...config,
      controllers: [...(existingConfig.controllers || []), ...(config.controllers || [])],
      globalMiddlewares: existingConfig.globalMiddlewares || config.globalMiddlewares,
      globalInterceptors: existingConfig.globalInterceptors || config.globalInterceptors || [],
    };

    Reflect.defineMetadata(SERVER_CONFIG_KEY, mergedConfig, target);

    if (config.controllers) {
      Reflect.defineMetadata(SERVER_MODULES_KEY, config.controllers, target);
    }

    return target;
  };
}

export function Use(middleware: any) {
  return function (target: any) {
    const existingConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, target) || {};
    const middlewares = existingConfig.globalMiddlewares || [];

    middlewares.push(middleware);
    Reflect.defineMetadata(
      SERVER_CONFIG_KEY,
      {
        ...existingConfig,
        globalMiddlewares: middlewares,
      },
      target,
    );

    return target;
  };
}

export function Port(port: number) {
  return function (target: any) {
    const existingConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, target) || {};

    Reflect.defineMetadata(
      SERVER_CONFIG_KEY,
      {
        ...existingConfig,
        port,
      },
      target,
    );

    return target;
  };
}
export function Host(host: string) {
  return function (target: any) {
    const existingConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, target) || {};

    Reflect.defineMetadata(
      SERVER_CONFIG_KEY,
      {
        ...existingConfig,
        host,
      },
      target,
    );

    return target;
  };
}
