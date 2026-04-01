/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import {
  CATCH,
  CONTROLLERS,
  CORS_METADATA,
  INTERCEPTOR,
  MIDDLEWARES,
  ROUTE_PREFIX,
  SANITIZE,
  SSE_METADATA_KEY,
  USE_MIDDLEWARE,
  WS_HANDLER,
  WS_TOPIC_KEY,
} from './constants';
import {
  ControllerClass,
  ControllerConfig,
  ControllerMeta,
  InterceptorCB,
  Request,
  Response,
  SeeControllerHandlers,
  WsControllerHandlers,
} from './types/core';
import {
  collectRoutes,
  execute,
  getControllerMethods,
  matchRoutes,
  NotFoundError,
} from './utils/core';

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
  config: string | ControllerConfig,
  middlewares: Array<InterceptorCB> = [],
) {
  // Handle both string and config object
  const routePrefix = typeof config === 'string' ? config : config.prefix;
  const controllers = typeof config === 'object' ? config.controllers : undefined;
  const controllerMiddlewares =
    typeof config === 'object' ? [...(config.middlewares || []), ...middlewares] : middlewares;
  const interceptor =
    typeof config === 'object' && typeof config.interceptor === 'function' && config.interceptor;

  return function <T extends ControllerClass>(constructor: T) {
    const proto = constructor.prototype;
    Reflect.defineMetadata('controller:name', constructor.name, proto);
    Reflect.defineMetadata(ROUTE_PREFIX, routePrefix, proto);
    Reflect.defineMetadata(MIDDLEWARES, controllerMiddlewares, proto);
    Reflect.defineMetadata(CONTROLLERS, controllers || [], proto);
    Reflect.defineMetadata(INTERCEPTOR, interceptor, proto);

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      Object.defineProperty(proto, key, descriptor);
    }

    return class C extends constructor {
      ws?: WsControllerHandlers;
      sse?: SeeControllerHandlers;
      execute = execute;
      getControllerMethods = getControllerMethods;

      precompiled: ControllerMeta;

      constructor(...args: any[]) {
        super(...args);
        this.lookupWS();
        this.lookupSSE();

        this.precompiled = this.meta(args[0]);
      }

      meta = (parent: ControllerMeta): ControllerMeta => {
        let prefix = parent.prefix + '/' + (Reflect.getMetadata(ROUTE_PREFIX, proto) ?? '/');
        prefix = prefix.replaceAll(/\/+/g, '/');
        const middlewares = [Reflect.getMetadata(MIDDLEWARES, proto)]
          .flat()
          .concat(Reflect.getMetadata(USE_MIDDLEWARE, constructor))
          .filter((el) => !!el);

        const interceptor = Reflect.getMetadata(INTERCEPTOR, proto);
        const subControllers = Reflect.getMetadata(CONTROLLERS, proto);
        const errorHandler = Reflect.getMetadata(CATCH, constructor);
        const cors = Reflect.getMetadata(CORS_METADATA, proto);
        const sanitizer = Reflect.getMetadata(SANITIZE, proto);

        const functions = {
          errors: errorHandler ? [errorHandler] : [],
          middlewares,
          sanitizers: sanitizer ? [sanitizer] : [],
        };

        const meta: ControllerMeta = {
          routes: [],
          functions: [...parent.functions, functions],
          prefix,
          interceptors: [interceptor, ...parent.interceptors].filter((e) => !!e),
          cors: [...parent.cors, cors].filter((e) => !!e),
        };

        meta.routes = collectRoutes(this, meta, prefix);
        const children = subControllers.map((Controller: any) => new Controller(meta).precompiled);
        meta.children = children;

        return meta;
      };

      handleRequest = async (request: Request, response: Response) => {
        const matched = matchRoutes(this.precompiled, request.url, request.method);
        if (!matched) {
          return response.error(
            new NotFoundError(`Route ${request.url} not found`, request.requestId),
          );
        }

        return this.execute(matched, request, response);
      };

      lookupWS() {
        const connection = this.getWSHandlers('connection');
        const message = this.getWSHandlers('message');
        const error = this.getWSHandlers('error');
        const close = this.getWSHandlers('close');
        const topics = this.getWSHandlers('topics');

        if ([...connection, ...message, ...error, ...close, ...topics].length === 0) {
          return;
        }

        this.ws = { handlers: { connection, message, close, error }, topics };
      }
      lookupSSE() {
        const connection = this.getSSEHandlers('connection');
        const error = this.getSSEHandlers('error');
        const close = this.getSSEHandlers('close');

        if ([...connection, ...error, ...close].length === 0) {
          return;
        }

        this.sse = { handlers: { connection, close, error } };
      }

      getSSEController() {
        return {
          instance: this,
          handlers: {
            connection: this.getSSEHandlers('connection'),
            close: this.getSSEHandlers('close'),
            error: this.getSSEHandlers('error'),
          },
        };
      }

      getWSHandlers(type: string) {
        const handlers = Reflect.getMetadata(WS_HANDLER, this.constructor) || [];
        return this.typedHandlers(handlers, type);
      }

      getSSEHandlers(type: string) {
        const handlers = Reflect.getMetadata(SSE_METADATA_KEY, this.constructor) || [];

        return this.typedHandlers(handlers, type);
      }

      getWSTopics() {
        const topics = Reflect.getMetadata(WS_TOPIC_KEY, this.constructor) || [];

        return topics.map((t: any) => ({
          ...t,
          fn: this[t.method].bind(this),
        }));
      }

      typedHandlers = (handlers: any[], type: string) => {
        return handlers
          .filter((h: any) => h.type === type)
          .map((h: any) => ({
            ...h,
            fn: this[h.method].bind(this),
          }));
      };
    };
  };
}
