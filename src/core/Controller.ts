/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CATCH,
  CONTROLLERS,
  ENDPOINT,
  INTERCEPTOR,
  MIDDLEWARES,
  OK_METADATA_KEY,
  OK_STATUSES,
  ROUTE_PREFIX,
} from '@constants';
import {
  AppRequest,
  ControllerClass,
  ControllerConfig,
  ControllerInstance,
  InterceptorCB,
  RouteContext,
} from '@types';
import { executeControllerMethod, getControllerMethods, matchRoute } from '@utils';
import { IncomingMessage, ServerResponse } from 'http';
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
        payload: any;
        interceptors: InterceptorCB[];
        request?: IncomingMessage;
        response?: ServerResponse;
      }) {
        try {
          let appResponse = await this.executeControllerMethod(
            data.controllerInstance,
            data.name,
            data.payload,
            data.request,
            data.response,
          );

          let status = appResponse.status ?? 200;

          const isError = !OK_STATUSES.includes(status);

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
            !isError && (status = methodOkStatus);
          } else {
            const classOkStatus = Reflect.getMetadata(OK_METADATA_KEY, prototype);
            !isError && classOkStatus && (status = classOkStatus);
          }

          return { status, data: appResponse };
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
      handleRequest = async (
        appRequest: AppRequest,
        request?: IncomingMessage,
        response?: ServerResponse,
      ) => {
        const context: RouteContext = {
          controllerInstance: this,
          controllerMeta: {
            routePrefix: Reflect.getMetadata(ROUTE_PREFIX, proto) || '',
            middlewares: Reflect.getMetadata(MIDDLEWARES, proto) || [],
            interceptor: Reflect.getMetadata(INTERCEPTOR, proto),
            subControllers: Reflect.getMetadata(CONTROLLERS, proto) || [],
            errorHandler: Reflect.getMetadata(CATCH, proto),
          },
          path: (appRequest.url.pathname ?? '').replace(/^\/+/g, ''),
          method: appRequest.method.toUpperCase(),
          appRequest,
          request,
          response,
          middlewareChain: [],
          interceptorChain: [],
          subPath: Reflect.getMetadata(ROUTE_PREFIX, proto) || '',
        };

        const result = await this.routeWalker(context);
        return result || { status: 404, message: 'Method Not Found' };
      };

      async routeWalker(context: RouteContext): Promise<any> {
        const { controllerInstance, controllerMeta, path, method, subPath } = context;

        for (const SubController of controllerMeta.subControllers) {
          const subInstance = new SubController();

          const subMeta = {
            routePrefix: Reflect.getMetadata(ROUTE_PREFIX, SubController.prototype) || '',
            middlewares: Reflect.getMetadata(MIDDLEWARES, SubController.prototype) || [],
            interceptor: Reflect.getMetadata(INTERCEPTOR, SubController.prototype),
            errorHandler: Reflect.getMetadata(CATCH, SubController.prototype),
            subControllers: Reflect.getMetadata(CONTROLLERS, SubController.prototype) || [],
          };

          const fullSubPath = [subPath, subMeta.routePrefix]
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/');

          if (path.startsWith(fullSubPath)) {
            const subResult = await this.routeWalker({
              ...context,
              subPath: fullSubPath,
              controllerInstance: subInstance,
              controllerMeta: subMeta,
              path,
              middlewareChain: [...context.middlewareChain, ...controllerMeta.middlewares],
              interceptorChain: [...context.interceptorChain, controllerMeta.interceptor].filter(
                (el) => !!el,
              ),
            });

            if (subResult && subResult.status !== 404) {
              return subResult;
            }
          }
        }

        const routeMatch = this.findRouteInController(controllerInstance, subPath, path, method);

        if (routeMatch) {
          const { name, pathParams, methodMiddlewares, methodInterceptors } = routeMatch;

          const allMiddlewares = [
            ...context.middlewareChain,
            ...controllerMeta.middlewares,
            ...methodMiddlewares,
          ];

          let payload = { ...context.appRequest, params: pathParams };
          for (const mw of allMiddlewares) {
            const mwResult = await mw(payload, context.request, context.response);
            payload = { ...payload, ...mwResult };
          }

          return this.getResponse({
            interceptors: [...context.interceptorChain, controllerMeta.interceptor].filter(
              (el) => !!el,
            ),
            controllerInstance,
            name,
            payload,
            response: context.response,
            request: context.request,
          }).catch((error) => {
            if (controllerMeta.errorHandler) {
              return controllerMeta.errorHandler(error, context.request, context.response);
            }
            return error;
          });
        }

        return null;
      }

      getAllMethods(obj: any): string[] {
        let methods = new Set<string>();
        let current = Object.getPrototypeOf(obj);

        while (current && current !== Object.prototype) {
          Object.getOwnPropertyNames(current).forEach((name) => {
            if (name !== 'constructor' && typeof current[name] === 'function') {
              methods.add(name);
            }
          });
          current = Object.getPrototypeOf(current);
        }

        return Array.from(methods);
      }

      findRouteInController(instance: any, path: string, route: string, method: string) {
        const prototype = Object.getPrototypeOf(instance);
        const propertyNames = this.getAllMethods(instance);

        const matches: Array<{
          name: string;
          pathParams: Record<string, string>;
          priority: number;
          methodMiddlewares: any[];
          methodInterceptors: any[];
        }> = [];

        for (const name of propertyNames) {
          if (
            [
              'constructor',
              'getResponse',
              'routeWalker',
              'getAllMethods',
              'findRouteInController',
            ].includes(name)
          )
            continue;

          const endpointMeta = Reflect.getMetadata(ENDPOINT, prototype, name) || [];
          if (endpointMeta.length === 0) continue;

          const [httpMethod, routePattern] = endpointMeta;

          if (httpMethod !== method && httpMethod !== 'USE') {
            continue;
          }

          if (httpMethod === 'USE') {
            let useRoute = route.split('/');
            useRoute.pop();
            route = useRoute.join('/');
          }
          const current = [path, routePattern].join('/').replace(/\/+/g, '/');

          const pathParams = matchRoute(route, current);

          if (pathParams) {
            const priority = httpMethod === 'USE' ? 0 : Object.keys(pathParams).length > 0 ? 1 : 2;

            matches.push({
              name,
              pathParams,
              priority,
              methodMiddlewares: Reflect.getMetadata(MIDDLEWARES, prototype, name) || [],
              methodInterceptors: Reflect.getMetadata(INTERCEPTOR, prototype, name) || [],
            });
          }
        }

        matches.sort((a, b) => b.priority - a.priority);

        return matches[0] || null;
      }
    };
  };
}
