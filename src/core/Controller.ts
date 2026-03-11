/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CATCH,
  CONTROLLERS,
  CORS_METADATA,
  INCREMENT_STATISTIC,
  INTERCEPTOR,
  MIDDLEWARES,
  OK_METADATA_KEY,
  OK_STATUSES,
  ROUTE_PREFIX,
  USE_MIDDLEWARE,
} from '@constants';
import {
  AppRequest,
  ControllerClass,
  ControllerConfig,
  ControllerInstance,
  InterceptorCB,
  RouteContext,
} from '@types';
import {
  executeControllerMethod,
  findRouteInController,
  getControllerMethods,
  handleCORS,
  NextFN,
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

      const original = descriptor.value;

      Object.defineProperty(proto, key, {
        ...descriptor,
        value: async function (...args: any[]) {
          try {
            return await original.apply(this, args);
          } catch (err: any) {
            return {
              status: err.status ?? 400,
              message: err.message,
              data: err,
            };
          }
        },
      });
    }

    return class extends constructor {
      executeControllerMethod = executeControllerMethod;
      getControllerMethods = getControllerMethods;
      constructor(...args: any[]) {
        super(...args);
      }

      async getResponse(data: {
        controllerInstance: ControllerInstance;
        name: string;
        interceptors: InterceptorCB[];
        request: AppRequest;
        response: ServerResponse;
      }) {
        try {
          let appResponse = await this.executeControllerMethod(
            data.controllerInstance,
            data.name,
            data.request,
            data.response,
          );

          data.response.statusCode = appResponse.status ?? 200;

          const isError = !OK_STATUSES.includes(data.response.statusCode);

          const interceptors = data.interceptors.reverse();

          for (let index = 0; index < interceptors?.length && !isError; index++) {
            const interceptor = interceptors[index];
            appResponse = await interceptor(appResponse, data.request, data.response);
          }

          const propertyName = data.name;
          const prototype = Object.getPrototypeOf(data.controllerInstance);

          const methodOkStatus = Reflect.getMetadata(
            OK_METADATA_KEY,
            data.controllerInstance,
            propertyName,
          );

          if (methodOkStatus) {
            !isError && (data.response.statusCode = methodOkStatus);
          } else {
            const classOkStatus = Reflect.getMetadata(OK_METADATA_KEY, prototype);
            !isError && classOkStatus && (data.response.statusCode = classOkStatus);
          }

          return { status: data.response.statusCode, data: appResponse };
        } catch (err) {
          throw err;
        }
      }
      handleRequest = async (request: AppRequest, response: ServerResponse) => {
        const middlewares = []
          .concat(Reflect.getMetadata(MIDDLEWARES, proto))
          .concat(Reflect.getMetadata(USE_MIDDLEWARE, constructor))
          .filter((el) => !!el);

        const cors = []
          .concat(Reflect.getMetadata(CORS_METADATA, proto))
          .concat(Reflect.getMetadata(CORS_METADATA, constructor))
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
          },
          path: (request.requestUrl.pathname ?? '').replace(/^\/+/g, ''),
          method: request.method.toUpperCase(),
          middlewareChain: [],
          interceptorChain: [],
          corsChain: [Reflect.getMetadata(CORS_METADATA, proto)],
          errorHandlerChain: [Reflect.getMetadata(CATCH, proto)],
          subPath: Reflect.getMetadata(ROUTE_PREFIX, proto) || '',
        };

        const result = await this.routeWalker(context, request, response);
        return result || { status: 404, message: 'Method Not Found' };
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

          const subMeta = {
            routePrefix: Reflect.getMetadata(ROUTE_PREFIX, SubController.prototype) || '',
            middlewares,
            interceptor: Reflect.getMetadata(INTERCEPTOR, SubController.prototype),
            errorHandler: Reflect.getMetadata(CATCH, SubController),
            subControllers: Reflect.getMetadata(CONTROLLERS, SubController.prototype) || [],
            cors: Reflect.getMetadata(CORS_METADATA, SubController.prototype) || [],
          };

          const fullSubPath = [subPath, subMeta.routePrefix]
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/');

          if (path.startsWith(fullSubPath)) {
            const walkerData = {
              ...context,
              subPath: fullSubPath,
              controllerInstance: subInstance,
              controllerMeta: subMeta,
              path,
              middlewareChain: [...context.middlewareChain, ...controllerMeta.middlewares],
              errorHandlerChain: [...context.errorHandlerChain, subMeta.errorHandler].filter(
                (el) => !!el,
              ),
              interceptorChain: [...context.interceptorChain, controllerMeta.interceptor].filter(
                (el) => !!el,
              ),
              corsChain: [...context.corsChain, subMeta.cors].filter((el) => !!el),
            };
            const subResult = await this.routeWalker(walkerData, request, response);

            if (subResult && subResult.status !== 404) {
              return subResult;
            }
          }
        }

        const routeMatch = findRouteInController(controllerInstance, subPath, path, method);

        if (routeMatch) {
          const { name, pathParams, methodMiddlewares, cors } = routeMatch;
          Object.assign(request, { params: pathParams });

          const handledCors = context.corsChain
            .concat(cors ?? [])
            .flat()
            .reduce(
              (acc, conf) => {
                const cors = handleCORS(request, response, conf);
                return {
                  permitted: acc.permitted && cors.permitted,
                  continue: acc.continue && cors.continue,
                };
              },
              { permitted: true, continue: true },
            );

          if (!handledCors.permitted) {
            return { status: 403, message: 'CORS: Origin not allowed' };
          }
          if (!handledCors.continue && handledCors.permitted) {
            return { status: 204 };
          }

          const allMiddlewares = [...context.middlewareChain, ...controllerMeta.middlewares];

          for (const mw of allMiddlewares) {
            await mw(request, response, NextFN);
          }

          let apiResponse = await this.getResponse({
            interceptors: [...context.interceptorChain, controllerMeta.interceptor].filter(
              (el) => !!el,
            ),
            controllerInstance,
            name,
            response: response,
            request: request,
          }).catch((err) => err);

          const isError = !OK_STATUSES.includes(apiResponse.status);

          if (isError) {
            for (const handler of context.errorHandlerChain?.reverse() || []) {
              apiResponse = handler(apiResponse);
            }
          }

          return apiResponse;
        }

        return null;
      }
    };
  };
}
