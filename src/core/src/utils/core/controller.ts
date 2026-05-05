import { TO_VALIDATE } from '../../constants';
import type {
  ControllerInstance,
  ControllerMeta,
  ErrorHandler,
  GuardClass,
  GuardFunction,
  GuardInstance,
  Request,
  Response,
  Route,
} from '../../types/core';
import { ErrorCode } from '../../types/core';
import { reflectMiddlewaresMetadata, reflectRouteMetadata, validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { handleCORS } from './cors';
import { ForbiddenError } from './error';
import { extractMiddlewares, getBodyAndMultipart, getParams } from './helper';
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
    { permitted: true, continue: true }
  );

  if (!handledCors.permitted) {
    response.status = 403;
    response.error(new ForbiddenError('Cors not permitted'));
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
      route.parameters.length ? Math.max(...route.parameters.map((p) => p.index)) + 1 : 0
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
        const validated = await validate(param.dto, value, param.options);

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
      response.status = route.functions.find((fn) => fn.status)?.status ?? 200;
      const interceptors = extractMiddlewares(route.functions, 'interceptor').reverse();

      for (const interceptor of interceptors) {
        data = await Promise.resolve(interceptor!(data, data.request, data.response));
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

    let caught = error;

    const errorHandlers = extractMiddlewares(route.functions, 'errorHandler').reverse();

    for (const handler of errorHandlers) {
      const resp = await Promise.resolve(handler!(caught as Error, request, response)).catch(
        (err) => err
      );
      caught = resp;
      if (resp instanceof Error) {
        continue;
      }

      response.data = caught;
      break;
    }

    if (caught instanceof Error) {
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
        response.error(caught);
      }
    }
    return response;
  }
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

  return Array.from(methods).filter((name) => !['constructor'].includes(name));
};

export const NextFunction = (error?: Error) => {
  if (error) throw error;
};

function isGuardInstance(guard: any): guard is GuardInstance {
  return typeof guard === 'object' && guard !== null && typeof guard.canActivate === 'function';
}

function isGuardClass(guard: any): guard is GuardClass {
  return (
    typeof guard === 'function' &&
    guard.prototype &&
    typeof guard.prototype.canActivate === 'function'
  );
}

async function runGuard(
  guard: GuardInstance | GuardClass | GuardFunction,
  request: Request,
  response: Response
) {
  let canActivate;
  let message = 'Forbidden';
  if (isGuardInstance(guard)) {
    canActivate = await guard.canActivate(request, response);
    message = guard.message ?? message;
  } else if (isGuardClass(guard)) {
    const guardInstance = new guard();
    canActivate = await guardInstance.canActivate(request, response);
    message = guardInstance.message ?? message;
  } else {
    const result = await guard(request, response);
    if (result === false) {
      canActivate = false;
    }
    if (typeof result === 'string') {
      canActivate = false;
      message = result;
    }
  }
  if (!canActivate) {
    throw new ForbiddenError(message);
  }
}

export const beforeRequest = async (request: Request, response: Response, route: Route) => {
  const handlers: ErrorHandler[] = [];
  try {
    for (const fn of route.functions) {
      if (fn.sanitizer) {
        sanitizeRequest(request, fn.sanitizer);
      }
      if (fn.guard) {
        await runGuard(fn.guard, request, response);
      }

      if (fn.pipe) {
        const pipe = fn.pipe;
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

      if (fn.middleware) {
        await fn.middleware(request, response, NextFunction);
      }

      if (fn.errorHandler) {
        handlers.unshift(fn.errorHandler);
      }
    }
  } catch (err: any) {
    if ([ErrorCode.FORBIDDEN, ErrorCode.RATE_LIMIT_EXCEEDED].includes(err.code)) {
      throw err;
    }
    const promises = handlers.map((handler) => handler(err, request, response));
    if (promises.length) return Promise.all(promises);
    throw err;
  }
};

export function collectRoutes(
  instance: ControllerInstance,
  meta: Omit<ControllerMeta, 'controllers'>,
  prefix = '/'
) {
  const propertyNames = getAllMethods(instance.constructor.prototype);

  const routes: Route[] = [];

  for (const name of propertyNames) {
    const functions = reflectMiddlewaresMetadata(instance, name);
    const routeMeta = reflectRouteMetadata(instance, name);

    const current = [prefix, routeMeta.route].join('/').replace(/\/+/g, '/');
    const routeMiddlewares = routeMeta.middlewares?.map?.((middleware) => ({ middleware })) ?? [];

    functions.unshift(...routeMiddlewares.reverse());

    routes.push({
      ...routeMeta,
      name,
      route: current,
      functions: [...meta.functions, ...functions],
      fn: instance[name].bind(instance),
    });
  }

  return routes;
}
