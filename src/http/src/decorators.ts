import { SERVER_CONFIG_KEY } from '@heliosjs/core/constants';
import type { ServerConfig } from './types/http';

/**
 * Class decorator that declares the HTTP server configuration on the app/root
 * class passed to `new Helios(AppClass)`. Can be applied together with `@Port` /
 * `@Host` and even repeated — each application **merges** into the previous
 * config, with `controllers` and `middlewares` **concatenated** (not replaced) so
 * setup can be split across modules.
 *
 * @param config - Any subset of {@link ServerConfig} except the internal
 *   `interceptors` field. Common keys: `port`, `host`, `controllers`,
 *   `middlewares`, `cors`, `errorHandler`, `sanitizers`, `statics`, `log`,
 *   `rbac`, `fingerprint`, `bodyLimit`, `trustProxy`, `websocket`, `sse`,
 *   `graphql`. Why: one decorator wires the whole application; see each field's
 *   own doc for semantics.
 *
 * @returns A class decorator.
 *
 * @example
 * @Server({
 *   port: 3000,
 *   controllers: [UserController, ProductController],
 *   middlewares: [requestIdMiddleware],
 *   cors: { origin: ['https://app.example.com'], credentials: true },
 *   trustProxy: true,
 * })
 * class AppModule {}
 *
 * const app = new Helios(AppModule);
 * await app.listen();
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
 * @Port(8080)
 * class MyServer {}
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
 * @Host('localhost')
 * class MyServer {}
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
