import { SERVER_CONFIG_KEY } from '@constants';
import { ServerConfig } from '@types';

export function Server(config: ServerConfig = {}) {
  return function (target: any) {
    const existingConfig = Reflect.getMetadata(SERVER_CONFIG_KEY, target) || {};

    const mergedConfig = {
      ...existingConfig,
      ...config,
      controllers: [...(existingConfig.controllers || []), ...(config.controllers || [])],
      middlewares: [...(existingConfig.middlewares ?? []), ...(config.middlewares ?? [])],
      cors: config.cors,
      interceptors: existingConfig.interceptor ?? config.interceptor,
    };

    Reflect.defineMetadata(SERVER_CONFIG_KEY, mergedConfig, target);

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
