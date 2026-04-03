import { SERVER_CONFIG_KEY } from './constants';
import { ServerConfig } from './types/http';

/**
 * Class decorator to configure the HTTP server with specified options.
 *
 * This decorator allows you to define and merge server configuration metadata
 * such as port, host, controllers, middlewares, CORS settings, and interceptors
 * on the target class. It merges the provided configuration with any existing
 * metadata to enable incremental and modular server setup.
 *
 * @param {Omit<ServerConfig, 'interceptors'>} config - Partial server configuration object excluding interceptors.
 *   - port: The port number the server will listen on.
 *   - host: The hostname or IP address the server will bind to.
 *   - controllers: Array of controller classes to handle routes.
 *   - middlewares: Array of middleware functions to apply.
 *   - interceptor: Interceptor to apply.
 *   - cors: CORS configuration options.
 *
 * @returns {ClassDecorator} A class decorator function that applies the merged server configuration metadata.
 *
 * @example
 * ```ts
 * @Server({
 *   port: 3000,
 *   controllers: [UserController, ProductController],
 *   middlewares: [AuthMiddleware],
 *   cors: { origin: '*' },
 * })
 * class MyServer {}
 * ```
 *
 * @remarks
 * The decorator uses Reflect Metadata API to store and merge configuration under the key `SERVER_CONFIG_KEY`.
 * Controllers and middlewares arrays are concatenated with existing metadata to support multiple decorators or incremental additions.
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
 * Class decorator to specify the port number on which the HTTP server should listen.
 *
 * This decorator updates the server configuration metadata with the given port number.
 * It merges with any existing metadata to preserve other server settings.
 *
 * @param {number} port - The TCP port number for the server to listen on.
 *
 * @returns {ClassDecorator} A class decorator function that sets the port metadata.
 *
 * @example
 * ```ts
 * @Port(8080)
 * class MyServer {}
 * ```
 *
 * @remarks
 * Uses Reflect Metadata API to store the port under the `SERVER_CONFIG_KEY` metadata key.
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
 * Class decorator to specify the host address for the HTTP server.
 *
 * This decorator updates the server configuration metadata with the given host string.
 * It merges with any existing metadata to preserve other server settings.
 *
 * @param {string} host - The hostname or IP address to bind the server.
 *
 * @returns {ClassDecorator} A class decorator function that sets the host metadata.
 *
 * @example
 * ```ts
 * @Host('localhost')
 * class MyServer {}
 * ```
 *
 * @remarks
 * Uses Reflect Metadata API to store the host under the `SERVER_CONFIG_KEY` metadata key.
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
