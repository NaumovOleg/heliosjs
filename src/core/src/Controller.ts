/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ControllerClass,
  ControllerConfig,
  ControllerMeta,
  MiddlewareCB,
  SeeControllerHandlers,
  WsControllerHandlers,
} from './types/core';
import { defineControllerMeta, defineMiddlewaresMeta } from './utils/shared';
import descriptors from './descriptors';

/**
 * Class decorator to define a controller with optional configuration.
 *
 * This decorator can be used with a string prefix or a configuration object.
 * It sets up metadata for route prefix, middlewares, sub-controllers, and interceptors.
 *
 * It wraps all controller methods to handle errors gracefully by catching exceptions
 * and returning a standardized error response.
 *
 * The decorated controller class is extended with methods to:
 * - execute controller methods with proper context and error handling
 * - retrieve controller methods metadata
 * - handle incoming requests by matching routes, applying middlewares and interceptors,
 *   and returning appropriate responses
 *
 * @param config - Either a string representing the route prefix or a configuration object
 *                 containing prefix, middlewares, sub-controllers, and interceptors.
 * @param middlewares - Additional interceptors to apply at the controller level.
 *
 * @returns A class decorator function that enhances the controller class.
 */
export function Controller(
  path: string,
  middlewares?: MiddlewareCB[]
): <T extends ControllerClass>(constructor: T) => any;
export function Controller(
  config: ControllerConfig
): <T extends ControllerClass>(constructor: T) => any;

export function Controller(config: string | ControllerConfig, middlewares: MiddlewareCB[] = []) {
  // Handle both string and config object
  const routePrefix = (typeof config === 'string' ? config : config.prefix) ?? '/';
  const controllers = typeof config === 'object' ? config.controllers ?? [] : [];
  const controllerMiddlewares =
    typeof config === 'string' ? middlewares ?? [] : config.middlewares ?? [];

  return function <T extends ControllerClass>(constructor: T) {
    if (typeof routePrefix !== 'string') {
      throw new TypeError(`Error in ${constructor.name}. Invalid route prefix.`);
    }
    if (controllers.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid sub-controllers`);
    }
    if (middlewares.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid middlewares`);
    }

    const Wrapped = class extends constructor {
      websocket?: WsControllerHandlers;
      sse?: SeeControllerHandlers;
      precompiled: ControllerMeta;

      constructor(...args: any[]) {
        super(...args);
        this.lookupWs();
        this.lookupSse();

        this.precompiled = this.meta(args[0]);
      }
    };

    Object.defineProperties(Wrapped.prototype, descriptors);

    const proto = Wrapped.prototype;

    defineControllerMeta({ name: constructor.name, prefix: routePrefix, controllers }, proto);
    defineMiddlewaresMeta(
      controllerMiddlewares.map((middleware) => ({ middleware })),
      constructor
    );

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      Object.defineProperty(proto, key, descriptor);
    }

    return Wrapped;
  };
}
