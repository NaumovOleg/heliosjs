/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CONTROLLERS,
  ENDPOINT,
  INTERCEPTORS,
  MIDDLEWARES,
  OK_METADATA_KEY,
  OK_STATUSES,
  ROUTE_PREFIX,
} from '@constants';
import { Interceptor, Middleware } from '@types';
import { executeControllerMethod, getControllerMethods, matchRoute } from '@utils';
import { ServerResponse } from 'http';
import 'reflect-metadata';

type ControllerClass = { new (...args: any[]): any };
type ControllerInstance = InstanceType<ControllerClass>;

interface ControllerConfig {
  prefix: string;
  middlewares?: Array<Middleware>;
  controllers?: ControllerClass[];
  interceptors?: Array<(...args: any[]) => any> | ((...args: any[]) => any);
}

export function Controller(
  config: string | ControllerConfig,
  middlewares: Array<Interceptor> = [],
) {
  // Handle both string and config object
  const routePrefix = typeof config === 'string' ? config : config.prefix;
  const controllers = typeof config === 'object' ? config.controllers : undefined;
  const controllerMiddlewares =
    typeof config === 'object' ? [...(config.middlewares || []), ...middlewares] : middlewares;

  const interceptors =
    typeof config === 'object'
      ? config.interceptors
        ? ([] as any).concat(config.interceptors)
        : []
      : [];

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
        response?: ServerResponse;
      }) {
        try {
          let response = await this.executeControllerMethod(
            data.controllerInstance,
            data.name,
            data.payload,
            data.response,
          );

          let status = response.status ?? 200;

          const isError = !OK_STATUSES.includes(status);

          for (let index = 0; index < data.interceptors?.length && !isError; index++) {
            const interceptor = data.interceptors[index];
            response = await interceptor(response);
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

          return { status, data: response };
        } catch (err) {
          console.error(err);
          throw err;
        }
      }

      handleRequest = async (request: any, response?: ServerResponse) => {
        const method = request.method;
        const path = (request.url.path ?? request.url.pathname ?? '').replace(/^\/+/, '');

        const baseInterceptors = Reflect.getMetadata(INTERCEPTORS, proto);

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
                  const middlawareResponde = await middleware(payload, response);
                  payload = { ...payload, ...middlawareResponde };
                }

                return this.getResponse({
                  interceptors: [...subInterceptors, ...baseInterceptors],
                  controllerInstance,
                  name: methodInfo.name,
                  payload,
                  response,
                });
              }
            }
          }
        }

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
                interceptors: baseInterceptors,
                controllerInstance: this,
                name: propertyName,
                payload,
                response,
              });
            }
          }
        }

        return { status: 404, message: 'Method Not Found' };
      };
    };
  };
}
