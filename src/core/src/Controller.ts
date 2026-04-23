/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import {
  GET_SSE_CONTROLLER_HASH,
  GET_SSE_HANDLERS_HASH,
  GET_WS_HANDLERS_HASH,
  GET_WS_TOPICS_HASH,
  HANDLE_REQUEST_HASH,
  LOOKUP_SEE_HASH,
  LOOKUP_WS_HASH,
  META_HASH,
  PRECOMILED_HASH,
  SSE_HASH,
  SSE_METADATA_KEY,
  TYPED_HANDLER_HASH,
  WS_HANDLER,
  WS_HASH,
  WS_TOPIC_KEY,
} from './constants';
import {
  ControllerClass,
  ControllerConfig,
  ControllerMeta,
  MiddlewareCB,
  Request,
  Response,
  SeeControllerHandlers,
  WsControllerHandlers,
} from './types/core';
import { collectRoutes, execute, matchRoutes, NotFoundError } from './utils/core';
import {
  defineControllerMeta,
  defineMiddlewaresMeta,
  reflectControllerMeta,
  reflectMiddlewaresMetadata,
} from './utils/shared';

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
  const controllers = typeof config === 'object' ? (config.controllers ?? []) : [];
  const controllerMiddlewares =
    typeof config === 'string' ? (middlewares ?? []) : (config.middlewares ?? []);

  return function <T extends ControllerClass>(constructor: T) {
    if (typeof routePrefix !== 'string') {
      throw new TypeError(`Error in ${constructor.name}. Invalid route prefix.`);
    }
    if (controllers.some(c => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid subcontrollers`);
    }
    if (middlewares.some(c => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid middlewares`);
    }
    const proto = constructor.prototype;

    defineControllerMeta({ name: constructor.name, prefix: routePrefix, controllers }, proto);
    defineMiddlewaresMeta({ middlewares: controllerMiddlewares }, constructor);

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      Object.defineProperty(proto, key, descriptor);
    }

    return class extends constructor {
      [WS_HASH]?: WsControllerHandlers;
      [SSE_HASH]?: SeeControllerHandlers;

      [PRECOMILED_HASH]: ControllerMeta;

      constructor(...args: any[]) {
        super(...args);
        this[LOOKUP_WS_HASH]();
        this[LOOKUP_SEE_HASH]();

        this[PRECOMILED_HASH] = this[META_HASH](args[0]);
      }

      [META_HASH] = (parent: Omit<ControllerMeta, 'controllers'>): ControllerMeta => {
        const controller = reflectControllerMeta(proto);
        const functions = reflectMiddlewaresMetadata(constructor);
        const prefix = (parent.prefix + '/' + controller.prefix).replaceAll(/\/+/g, '/');

        const meta: Omit<ControllerMeta, 'controllers'> = {
          routes: [],
          functions: [...parent.functions, functions],
          prefix,
          name: controller.name,
        };

        meta.routes = collectRoutes(this, meta, prefix);

        const children = controller.controllers.map(
          (Controller: any) => new Controller(meta)[PRECOMILED_HASH],
        );
        meta.children = children;

        return { ...controller, ...meta, controllers: controller.controllers };
      };

      [HANDLE_REQUEST_HASH] = async (request: Request, response: Response) => {
        const matched = matchRoutes(this[PRECOMILED_HASH], request.url, request.method);
        if (!matched) {
          return response.error(
            new NotFoundError(`Route ${request.url} not found`, request.requestId),
          );
        }

        return execute(matched, request, response);
      };

      [LOOKUP_WS_HASH]() {
        const connection = this[GET_WS_HANDLERS_HASH]('connection');
        const message = this[GET_WS_HANDLERS_HASH]('message');
        const error = this[GET_WS_HANDLERS_HASH]('error');
        const close = this[GET_WS_HANDLERS_HASH]('close');
        const topics = this[GET_WS_HANDLERS_HASH]('topics');

        if ([...connection, ...message, ...error, ...close, ...topics].length === 0) {
          return;
        }

        this[WS_HASH] = { handlers: { connection, message, close, error }, topics };
      }
      [LOOKUP_SEE_HASH]() {
        const connection = this[GET_SSE_HANDLERS_HASH]('connection');
        const error = this[GET_SSE_HANDLERS_HASH]('error');
        const close = this[GET_SSE_HANDLERS_HASH]('close');

        if ([...connection, ...error, ...close].length === 0) {
          return;
        }

        this[SSE_HASH] = { handlers: { connection, close, error } };
      }

      [GET_SSE_CONTROLLER_HASH]() {
        return {
          instance: this,
          handlers: {
            connection: this[GET_SSE_HANDLERS_HASH]('connection'),
            close: this[GET_SSE_HANDLERS_HASH]('close'),
            error: this[GET_SSE_HANDLERS_HASH]('error'),
          },
        };
      }

      [GET_WS_HANDLERS_HASH](type: string) {
        const handlers = Reflect.getMetadata(WS_HANDLER, this.constructor) || [];
        return this[TYPED_HANDLER_HASH](handlers, type);
      }

      [GET_SSE_HANDLERS_HASH](type: string) {
        const handlers = Reflect.getMetadata(SSE_METADATA_KEY, this.constructor) || [];

        return this[TYPED_HANDLER_HASH](handlers, type);
      }

      [GET_WS_TOPICS_HASH]() {
        const topics = Reflect.getMetadata(WS_TOPIC_KEY, this.constructor) || [];

        return topics.map((t: any) => ({
          ...t,
          fn: (this[t.method] as any).bind(this),
        }));
      }

      [TYPED_HANDLER_HASH] = (handlers: any[], type: string) => {
        return handlers
          .filter((h: any) => h.type === type)
          .map((h: any) => ({
            ...h,
            fn: (this[h.method] as any).bind(this),
          }));
      };
    };
  };
}
