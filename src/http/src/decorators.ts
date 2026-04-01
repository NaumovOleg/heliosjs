import { SERVER_CONFIG_KEY } from './constants';
import { ServerConfig } from './types/http';

/**
 * Class decorator to configure the server with the given options.
 *
 * @param {ServerConfig} config - Configuration options for the server.
 *
 * Usage:
 * ```ts
 * @Server({ port: 3000, controllers: [...], middlewares: [...] })
 * class MyServer {}
 * ```
 *
 * This decorator merges the provided configuration with any existing metadata on the target class.
 */
export function Server(config: Omit<ServerConfig, 'interceptors'> = {}) {
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

/**
 * Class decorator to set the port number for the server.
 *
 * @param {number} port - The port number to listen on.
 *
 * Usage:
 * ```ts
 * @Port(8080)
 * class MyServer {}
 * ```
 *
 * This decorator updates the server metadata with the specified port.
 */
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

/**
 * Class decorator to set the host for the server.
 *
 * @param {string} host - The hostname or IP address to bind the server.
 *
 * Usage:
 * ```ts
 * @Host('localhost')
 * class MyServer {}
 * ```
 *
 * This decorator updates the server metadata with the specified host.
 */
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
