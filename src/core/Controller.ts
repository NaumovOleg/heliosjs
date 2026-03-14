/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CATCH,
  CONTROLLERS,
  CORS_METADATA,
  INCREMENT_STATISTIC,
  INTERCEPTOR,
  MIDDLEWARES,
  ROUTE_PREFIX,
  SANITIZE,
  SSE_METADATA_KEY,
  USE_MIDDLEWARE,
  WS_HANDLER,
  WS_TOPIC_KEY,
} from '@constants';
import {
  AppRequest,
  ControllerClass,
  ControllerConfig,
  InterceptorCB,
  ResponseWithStatus,
  RouteContext,
  SeeControllerHandlers,
  WsControllerHandlers,
} from '@types';
import {
  applyMiddlewaresVsSanitizers,
  executeControllerMethod,
  findRouteInController,
  getControllerMethods,
  getErrorType,
  getResponse,
  handleCORS,
  pathStartsWithPrefix,
} from '@utils';
import { ServerResponse } from 'http';
import 'reflect-metadata';

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
  INCREMENT_STATISTIC('controllers');
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
      constructor(...args: any[]) {
        super(...args);
        this.lookupWS();
        this.lookupSSE();
      }

      handleRequest = async (request: AppRequest, response: ServerResponse) => {
        const middlewares = []
          .concat(Reflect.getMetadata(MIDDLEWARES, proto))
          .concat(Reflect.getMetadata(USE_MIDDLEWARE, constructor))
          .filter((el) => !!el);

        const context: RouteContext = {
          controllerInstance: this,
          controllerMeta: {
            routePrefix: Reflect.getMetadata(ROUTE_PREFIX, proto) || '',
            middlewares,
            interceptor: Reflect.getMetadata(INTERCEPTOR, proto),
            subControllers: Reflect.getMetadata(CONTROLLERS, proto) || [],
            errorHandler: Reflect.getMetadata(CATCH, constructor),
            cors: Reflect.getMetadata(CORS_METADATA, proto),
            sanitizers: Reflect.getMetadata(SANITIZE, proto) || [],
          },
          path: (request.requestUrl.pathname ?? '').replace(/^\/+/g, ''),
          method: request.method.toUpperCase(),
          middlewareChain: [],
          interceptorChain: [],
          sanitizersChain: [],
          corsChain: [Reflect.getMetadata(CORS_METADATA, proto)],
          errorHandlerChain: [Reflect.getMetadata(CATCH, proto)],
          subPath: Reflect.getMetadata(ROUTE_PREFIX, proto) || '',
        };

        return this.routeWalker(context, request, response);
      };

      async routeWalker(
        context: RouteContext,
        request: AppRequest,
        response: ServerResponse,
      ): Promise<any> {
        const { controllerInstance, controllerMeta, path, method, subPath } = context;

        for (const SubController of controllerMeta.subControllers) {
          const subInstance = new SubController();

          const middlewares = []
            .concat(Reflect.getMetadata(MIDDLEWARES, SubController.prototype))
            .concat(Reflect.getMetadata(USE_MIDDLEWARE, SubController))
            .filter((el) => !!el);

          const sanitizers = []
            .concat(Reflect.getMetadata(SANITIZE, SubController.prototype))
            .concat(Reflect.getMetadata(SANITIZE, SubController))
            .filter((el) => !!el);

          const subMeta = {
            routePrefix: Reflect.getMetadata(ROUTE_PREFIX, SubController.prototype) || '',
            middlewares,
            interceptor: Reflect.getMetadata(INTERCEPTOR, SubController.prototype),
            errorHandler: Reflect.getMetadata(CATCH, SubController),
            subControllers: Reflect.getMetadata(CONTROLLERS, SubController.prototype) || [],
            cors: Reflect.getMetadata(CORS_METADATA, SubController.prototype) || [],
            sanitizers,
          };

          const fullSubPath = [subPath, subMeta.routePrefix]
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/');

          if (pathStartsWithPrefix(path, fullSubPath)) {
            const walkerData = {
              ...context,
              subPath: fullSubPath,
              controllerInstance: subInstance,
              controllerMeta: subMeta,
              path,
              middlewareChain: [...context.middlewareChain, ...controllerMeta.middlewares],
              sanitizersChain: [...context.sanitizersChain, ...controllerMeta.sanitizers],
              errorHandlerChain: [...context.errorHandlerChain, subMeta.errorHandler].filter(
                (el) => !!el,
              ),
              interceptorChain: [...context.interceptorChain, controllerMeta.interceptor].filter(
                (el) => !!el,
              ),
              corsChain: [...context.corsChain, subMeta.cors].filter((el) => !!el),
            };

            return this.routeWalker(walkerData, request, response);
          }
        }

        const routeMatch = findRouteInController(controllerInstance, subPath, path, method);

        if (!routeMatch) {
          return {};
        }
        let data;
        try {
          const { name, pathParams, middlewares, cors, sanitizers } = routeMatch;
          Object.assign(request, { params: pathParams });

          const handledCors = context.corsChain
            .concat(cors ?? [])
            .flat()
            .filter((el) => !!el)
            .reduce(
              (acc, conf) => {
                console.log(conf);
                const cors = handleCORS(request, response, conf);
                return {
                  permitted: acc.permitted && cors.permitted,
                  continue: acc.continue && cors.continue,
                };
              },
              { permitted: true, continue: true },
            );

          if (!handledCors.permitted) {
            response.statusCode = 403;
            data = 'Cors: Origin not allowed';
            return { routeMatch, data };
          }
          if (!handledCors.continue && handledCors.permitted) {
            response.statusCode = 204;
            return { routeMatch };
          }

          const controllerMiddlewares = [...context.middlewareChain, ...controllerMeta.middlewares];

          const controllerSanitizers = [
            ...context.sanitizersChain,
            ...controllerMeta.sanitizers,
          ].filter((el) => !!el);

          await applyMiddlewaresVsSanitizers(request, response, {
            sanitizers: [controllerSanitizers, sanitizers],
            middlewares: [controllerMiddlewares, middlewares],
          });

          data = await getResponse({
            interceptors: [...context.interceptorChain, controllerMeta.interceptor].filter(
              (el) => !!el,
            ),
            controllerInstance,
            name,
            response: response,
            request: request,
          });
        } catch (error: any) {
          let catched = error;
          let statusCode = error.status ?? error.statusCode ?? 500;
          catched.status = statusCode;

          for (const handler of context.errorHandlerChain?.reverse() || []) {
            try {
              catched = await Promise.resolve(handler(catched, request, response))
                .then((resp: ResponseWithStatus) => {
                  statusCode = 200;

                  return resp;
                })
                .catch((err: any) => {
                  statusCode = err.status ?? err.statusCode ?? statusCode;
                  return err;
                });
            } catch (errs) {}
          }

          response.statusCode = statusCode;

          data = catched;
        }

        if (getErrorType(data).isError && response.statusCode === 200) {
          response.statusCode = 500;
        }

        return { routeMatch, data };
      }

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
