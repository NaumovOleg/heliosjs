import 'reflect-metadata';
import { ENDPOINT, MIDDLEWARES, TO_VALIDATE } from '../../constants';
import {
  ControllerInstance,
  ControllerMeta,
  ControllerMethods,
  ErrorCode,
  ErrorHandler,
  HTTP_METHODS,
  Request,
  Response,
  Route,
} from '../../types/core';
import { reflectMiddlewaresMetadata, reflectRouteMetadata, validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { handleCORS } from './cors';
import { ForbiddenError } from './error';
import { getBodyAndMultipart, getParams } from './helper';
import { sanitizeRequest } from './sanitize';

export const execute = async (route: Route, request: Request, response: Response) => {
  request.params = getParams(route.route, request.url);

  const handledCors = (route.cors ?? []).reduce(
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
    response.status = 403;
    response.error(new ForbiddenError('Cors not pemitted'));
    return response;
  }

  if (!handledCors.continue && handledCors.permitted) {
    response.status = 204;
    return response;
  }

  try {
    await beforeRequest(request, response, route);

    const { body, multipart } = getBodyAndMultipart(request);

    const args: unknown[] = [];

    const totalParams = Math.max(
      route.parameters.length ? Math.max(...route.parameters.map((p) => p.index)) + 1 : 0,
    );

    for (let i = 0; i < totalParams; i++) {
      const param = route.parameters.find((p) => p.index === i);

      if (!param) {
        args[i] = undefined;
        continue;
      }

      let value = request[param.type as keyof Request];

      if (param.type === 'multipart') {
        value = multipart;
      }
      if (param.type === 'ws') {
        value = WebSocketService.getInstance();
      }
      if (param.type === 'sse') {
        value = SSEService.getInstance();
      }
      if (param.type === 'request') {
        value = request;
      }
      if (param.type === 'body') {
        value = body;
      }
      if (param.type === 'response') {
        value = response;
      }

      if (TO_VALIDATE.includes(param.type)) {
        const validated = await validate(param.dto, value);

        value = param.name ? validated?.[param.name] : validated;
      }

      args[i] = value;
    }
    if (args.length === 0) {
      args.push(request, response);
    }

    let data = await Promise.resolve(route.fn(...args));

    const isError = data instanceof Error;

    if (isError) {
      response.error(data);
    } else {
      response.status = route.ok;

      if (route.interceptor) {
        data = await Promise.resolve(route.interceptor(data, data.request, data.response));
      }
    }

    response.data = data;

    return response;
  } catch (error: any) {
    if (
      [
        ErrorCode.FORBIDDEN,
        ErrorCode.NOT_FOUND,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        ErrorCode.UNAUTHORIZED,
      ].includes(error.code)
    ) {
      response.error(error);
      return response;
    }
    let catched = error;

    for (const functions of route.functions.reverse()) {
      if (!functions.errors.length) continue;
      for (const handler of functions.errors) {
        const resp = await Promise.resolve(handler(catched as Error, request, response)).catch(
          (err) => err,
        );
        catched = resp;
        if (resp instanceof Error) {
          continue;
        }
        break;
      }
      if (catched instanceof Error) {
        continue;
      }
      response.data = catched;
      break;
    }
    if (catched instanceof Error) {
      if (typeof error === 'string') {
        const err = new Error(error);
        const errorData = {
          stack: `${err.name}: ${err.message}\n    at ${route.name}\n${err.stack}`,
          original: error,
          controller: route,
          method: route.name,
          status: 500,
        };
        Object.assign(err, errorData);
        response.error(err);
      } else {
        response.error(catched);
      }
    }

    return response;
  }
};

export const getControllerMethods = (controller: ControllerInstance) => {
  const methods: ControllerMethods = [];

  let proto = Object.getPrototypeOf(controller);

  while (proto && proto !== Object.prototype) {
    const propertyNames = Object.getOwnPropertyNames(proto);
    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;

      const endpointMeta = Reflect.getMetadata(ENDPOINT, proto, propertyName);

      if (endpointMeta) {
        const [httpMethod, pattern] = endpointMeta;
        const methodMiddlewares = Reflect.getMetadata(MIDDLEWARES, proto, propertyName);

        methods.push({
          name: propertyName,
          httpMethod,
          pattern,
          middlewares: methodMiddlewares,
        });
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return methods.sort((a) => (a.httpMethod === HTTP_METHODS.ANY ? 1 : -1));
};

export const getAllMethods = (obj: unknown): string[] => {
  const methods = new Set<string>();
  let current = Object.getPrototypeOf(obj);

  while (current && current !== Object.prototype) {
    Object.getOwnPropertyNames(current).forEach((name) => {
      if (name !== 'constructor' && typeof current[name] === 'function') {
        methods.add(name);
      }
    });
    current = Object.getPrototypeOf(current);
  }

  return Array.from(methods).filter(
    (name) =>
      ![
        'constructor',
        'meta',
        'getResponse',
        'routeWalker',
        'getAllMethods',
        'findRouteInController',
        'lookupSSE',
        'lookupWS',
        'getSSEController',
        'getWSHandlers',
        'getSSEHandlers',
        'getWSTopics',
        'typedHandlers',
      ].includes(name),
  );
};

export const NextFunction = (error?: Error) => {
  if (error) throw error;
};

export const beforeRequest = async (request: Request, response: Response, route: Route) => {
  const handlers: ErrorHandler[] = [];
  try {
    for (const batch of route.functions) {
      sanitizeRequest(request, batch.sanitizers);

      for (const guard of batch.guards) {
        const permitted = await ('canActivate' in guard
          ? guard.canActivate(request, response)
          : guard(request, response));
        if (!permitted) {
          throw new ForbiddenError();
        }
      }

      for (const pipe of batch.pipes) {
        if (pipe.body) {
          request.body = pipe.body(request.body, request);
        }

        if (pipe.query) {
          request.query = pipe.query(request.query, request);
        }

        if (pipe.params) {
          request.params = pipe.params(request.params, request);
        }

        if (pipe.headers) {
          request.headers = pipe.headers(request.headers, request);
        }
      }
      handlers.unshift(...batch.errors);

      for (const middleware of batch.middlewares) {
        await middleware(request, response, NextFunction);
      }
    }
  } catch (err: any) {
    if ([ErrorCode.FORBIDDEN, ErrorCode.RATE_LIMIT_EXCEEDED].includes(err.code)) {
      throw err;
    }
    const promises = handlers.map((handler) => handler(err, request, response));

    return Promise.all(promises).catch((err) => err);
  }
};

export const collectRoutes = (
  instance: ControllerInstance,

  meta: Omit<ControllerMeta, 'controllers'>,
  prefix: string = '/',
) => {
  const propertyNames = getAllMethods(instance);

  const routes: Route[] = [];

  for (const name of propertyNames) {
    const functions = reflectMiddlewaresMetadata(instance, name);
    const routeMeta = reflectRouteMetadata(instance, name);
    const ok = functions.status;
    const current = [prefix, routeMeta.route].join('/').replace(/\/+/g, '/');
    const parentInterceptors = meta.functions.flatMap(({ interceptors }) => interceptors);

    const interceptor =
      functions.interceptors[functions.interceptors.length - 1] ??
      parentInterceptors[parentInterceptors.length - 1];

    functions.middlewares.unshift(...routeMeta.middlewares);

    routes.push({
      ...routeMeta,
      name,
      route: current,
      ok: ok ?? 200,
      interceptor,
      functions: [...meta.functions, functions],
      fn: instance[name].bind(instance),
    });
  }

  return routes;
};
