/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import {
  CONTROLLERS,
  ENDPOINT,
  INTERCEPTORS,
  MIDDLEWARES,
  OK_METADATA_KEY,
  ROUTE_PREFIX,
} from '@constants';
import { Middleware } from '@types';
import {
  executeControllerMethod,
  getControllerMethods,
  matchRoute,
  ParseBody,
  Query,
} from '@utils';

type ControllerClass = { new (...args: any[]): any };
type ControllerInstance = InstanceType<ControllerClass>;

interface ControllerConfig {
  prefix: string;
  middlewares?: Array<Middleware>;
  controllers?: ControllerClass[];
  requestInterceptors?: Middleware[] | Middleware;
  responseInterceprors?: Array<(...args: any[]) => any> | ((...args: any[]) => any);
}

export function Controller(
  config: string | ControllerConfig,
  middlewares: Array<(Request: Request) => any> = [],
) {
  // Handle both string and config object
  const routePrefix = typeof config === 'string' ? config : config.prefix;
  const controllers = typeof config === 'object' ? config.controllers : undefined;
  const controllerMiddlewares =
    typeof config === 'object' ? [...(config.middlewares || []), ...middlewares] : middlewares;

  const interceptors =
    typeof config === 'object'
      ? {
          request: config.requestInterceptors ? ([] as any).concat(config.requestInterceptors) : [],
          response: config.responseInterceprors
            ? ([] as any).concat(config.responseInterceprors)
            : [],
        }
      : { request: [], response: [] };

  return function <T extends ControllerClass>(constructor: T) {
    const proto = constructor.prototype;

    Reflect.defineMetadata(ROUTE_PREFIX, routePrefix, proto);
    Reflect.defineMetadata(MIDDLEWARES, controllerMiddlewares, proto);
    Reflect.defineMetadata(CONTROLLERS, controllers || [], proto);
    Reflect.defineMetadata(INTERCEPTORS, interceptors, proto);

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
        interceptors: Array<(...args: any[]) => any | Promise<any>>;
      }) {
        try {
          let response = await this.executeControllerMethod(
            data.controllerInstance,
            data.name,
            data.payload,
          );

          for (let index = 0; index < data.interceptors?.length; index++) {
            const interceptor = data.interceptors[index];
            response = await interceptor(response);
          }

          const propertyName = data.name;
          const prototype = Object.getPrototypeOf(data.controllerInstance);

          let status = 200;
          const methodOkStatus = Reflect.getMetadata(
            OK_METADATA_KEY,
            data.controllerInstance,
            propertyName,
          );
          if (methodOkStatus) {
            status = methodOkStatus;
          } else {
            const classOkStatus = Reflect.getMetadata(OK_METADATA_KEY, prototype);
            if (classOkStatus) {
              status = classOkStatus;
            }
          }
          return { status: status ?? 200, data: response };
        } catch (err) {
          console.error(err);
          throw err;
        }
      }

      handleRequest = async (request: any) => {
        const method = request.method;
        const path = (request.url.path ?? request.url.pathname ?? '').replace(/^\/+/, '');

        request.headers = request.headers ?? {};
        request.cookies = request.cookies ?? {};

        try {
          request.body = ParseBody(request);
          request.query = Query(request.url);
        } catch (err) {
          throw { status: 500, message: 'Validation failed', data: err };
        }

        const baseInterceptors = Reflect.getMetadata(INTERCEPTORS, proto);

        for (let index = 0; index < baseInterceptors.request.length; index++) {
          const interceptor = interceptors.request[index];
          request = await interceptor(request);
        }

        const routePrefix: string = Reflect.getMetadata(ROUTE_PREFIX, proto) || '';
        const middlewares: Array<(Request: any) => any> =
          Reflect.getMetadata(MIDDLEWARES, proto) || [];
        const subControllers: ControllerClass[] = Reflect.getMetadata(CONTROLLERS, proto) || [];

        // Try sub-controllers
        for (const SubController of subControllers) {
          const controllerInstance = new SubController(SubController);
          if (!controllerInstance) continue;

          const subInterceptors = Reflect.getMetadata(INTERCEPTORS, controllerInstance);

          const controllerPrefix: string =
            Reflect.getMetadata(ROUTE_PREFIX, SubController.prototype) || '';
          const controllerMiddlewares: Array<(Request: any) => any> =
            Reflect.getMetadata(MIDDLEWARES, SubController.prototype) || [];

          const methods = this.getControllerMethods(controllerInstance);

          for (const methodInfo of methods) {
            if (methodInfo.httpMethod === method || methodInfo.httpMethod === 'USE') {
              // Build full pattern: main prefix + controller prefix + method pattern
              const fullPattern = [routePrefix, controllerPrefix, methodInfo.pattern]
                .filter(Boolean)
                .join('/')
                .replace(/\/+/g, '/');

              const pathParams = matchRoute(fullPattern, path);
              if (pathParams) {
                let payload = { ...request, params: pathParams };

                // Apply all middlewares in order: main controller -> sub-controller -> method
                for (const middleware of [
                  ...middlewares,
                  ...controllerMiddlewares,
                  ...(methodInfo.middlewares || []),
                ]) {
                  const middlawareResponde = await middleware(payload);
                  payload = { ...payload, ...middlawareResponde };
                }

                return this.getResponse({
                  interceptors: [...subInterceptors.response, ...baseInterceptors.response],
                  controllerInstance,
                  name: methodInfo.name,
                  payload,
                });
              }
            }
          }
        }
        // Try main controller methods first
        const propertyNames = Object.getOwnPropertyNames(proto);

        for (const propertyName of propertyNames) {
          const fn = (this as any)[propertyName];
          if (typeof fn !== 'function') continue;

          const endpointMeta = Reflect.getMetadata(ENDPOINT, proto, propertyName) || [];

          const [httpMethod, routePattern] = endpointMeta;

          if (httpMethod === method || httpMethod === 'USE') {
            const fullPattern = [routePrefix, routePattern]
              .filter(Boolean)
              .join('/')
              .replace(/\/+/g, '/');

            const pathParams = matchRoute(fullPattern, path);
            if (pathParams) {
              let payload = { ...request, params: pathParams };

              // Apply controller-level middlewares
              for (const middleware of middlewares) {
                const middlewareResponse = await middleware(payload);
                payload = { ...payload, middlewareResponse };
              }

              return this.getResponse({
                interceptors: baseInterceptors.response,
                controllerInstance: this,
                name: propertyName,
                payload,
              });
            }
          }
        }

        return { status: 404, message: 'Method Not Found' };
      };
    };
  };
}
