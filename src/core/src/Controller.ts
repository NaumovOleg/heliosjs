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
  ControllerMetadata,
  CORSConfig,
  ErorrHandler,
  InterceptorCB,
  MiddlewareCB,
  Request,
  Response,
  RouteContext,
  SanitizerConfig,
  SeeControllerHandlers,
  WsControllerHandlers,
} from './types/core';
import { executeControllerMethod, getControllerMethods, routeWalker } from './utils/core';

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
  let interceptor =
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

    return class extends constructor {
      ws?: WsControllerHandlers;
      sse?: SeeControllerHandlers;
      executeControllerMethod = executeControllerMethod;
      getControllerMethods = getControllerMethods;
      routePrefix?: string;
      middlewares: MiddlewareCB[] = [];
      interceptor?: InterceptorCB;
      subControllers: ControllerMetadata[] = [];
      errorHandler?: ErorrHandler;
      cors?: CORSConfig;
      sanitizers?: SanitizerConfig[];

      constructor(...args: any[]) {
        super(...args);
        this.lookupWS();
        this.lookupSSE();
      }

      handleRequest = async (request: Request, response: Response) => {
        const middlewares = this.middlewares
          .concat(Reflect.getMetadata(MIDDLEWARES, proto))
          .concat(Reflect.getMetadata(USE_MIDDLEWARE, constructor))
          .filter((el) => !!el);

        const routePrefix = this.routePrefix ?? Reflect.getMetadata(ROUTE_PREFIX, proto) ?? '/';
        const interceptor = this.interceptor ?? Reflect.getMetadata(INTERCEPTOR, proto);
        const subControllers =
          this.subControllers.concat(Reflect.getMetadata(CONTROLLERS, proto)) ?? [];
        const errorHandler = this.errorHandler ?? Reflect.getMetadata(CATCH, constructor);
        const cors = this.cors ?? Reflect.getMetadata(CORS_METADATA, proto);
        const sanitizers = this.sanitizers ?? Reflect.getMetadata(SANITIZE, proto) ?? [];

        const context: RouteContext = {
          controllerInstance: this,
          controllerMeta: {
            routePrefix,
            middlewares,
            interceptor,
            subControllers,
            errorHandler,
            cors,
            sanitizers,
          },
          path: (request.requestUrl.pathname ?? '').replace(/^\/+/g, ''),
          method: request.method.toUpperCase(),
          middlewareChain: [],
          interceptorChain: [],
          sanitizersChain: [],
          corsChain: [cors],
          errorHandlerChain: [errorHandler],
          subPath: routePrefix,
        };

        try {
          const done = await routeWalker(context, request, response);

          if (!done) {
            response.status = 404;
            response.data = 'Route not found';
            return false;
          }

          return true;
        } catch (err) {
          response.error(err);
          return true;
        }
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
