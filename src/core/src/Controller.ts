/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { CONTROLLER_CONFIG, SSE_METADATA_KEY, WS_HANDLER, WS_TOPIC_KEY } from './constants';
import {
  ControllerClass,
  ControllerConfig,
  ControllerMeta,
  ControllerMetadata,
  MiddlewareCB,
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
import { reflectMeta } from './utils/shared';

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
  middlewares?: Array<MiddlewareCB>,
): <T extends ControllerClass>(constructor: T) => any;
export function Controller(
  config: ControllerConfig,
): <T extends ControllerClass>(constructor: T) => any;

export function Controller(
  config: string | ControllerConfig,
  middlewares: Array<MiddlewareCB> = [],
) {
  // Handle both string and config object
  const routePrefix = (typeof config === 'string' ? config : config.prefix) ?? '/';
  const controllers = typeof config === 'object' ? config.controllers ?? [] : [];
  const cors = typeof config === 'object' ? config.cors : undefined;
  const controllerMiddlewares =
    typeof config === 'string' ? middlewares ?? [] : config.middlewares ?? [];
  const interceptor = typeof config === 'object' ? config.interceptor : undefined;

  return function <T extends ControllerClass>(constructor: T) {
    if (typeof routePrefix !== 'string') {
      throw new TypeError(`Error in ${constructor.name}. Invalid route prefix.`);
    }
    if (!!interceptor && typeof interceptor !== 'function') {
      throw new TypeError(`Error in ${constructor.name}. Invalid interceptor`);
    }
    if (controllers.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid subcontrollers`);
    }
    if (middlewares.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid middlewares`);
    }
    const proto = constructor.prototype;
    const meta: ControllerMetadata = {
      name: constructor.name,
      prefix: routePrefix,
      middlewares: controllerMiddlewares,
      controllers,
      cors,
    };
    Reflect.defineMetadata(CONTROLLER_CONFIG, meta, proto);

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      Object.defineProperty(proto, key, descriptor);
    }

    return class extends constructor {
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
        const controller = reflectMeta(proto);
        const subController = reflectMeta(constructor, 'sub');
        const prefix = (parent.prefix + '/' + controller.prefix).replaceAll(/\/+/g, '/');
        const middlewares = controller.middlewares.concat(subController.use).filter((el) => !!el);

        const functions = {
          errors: subController.catch,
          middlewares,
          sanitizers: subController.sanitizers,
        };

        const meta: ControllerMeta = {
          routes: [],
          functions: [...parent.functions, functions],
          prefix,
          interceptors: [controller.interceptor, ...parent.interceptors].filter((e) => !!e),
          cors: [...parent.cors, controller.cors, ...subController.cors].filter((e) => !!e),
        };

        meta.routes = collectRoutes(this, meta, prefix);
        const children = controller.controllers.map(
          (Controller: any) => new Controller(meta).precompiled,
        );
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
