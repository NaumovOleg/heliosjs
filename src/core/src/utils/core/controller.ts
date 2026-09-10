import { TO_VALIDATE } from '../../constants';
import { ErrorCode } from '../../types/core';
import type {
  Route,
  MiddlewaresMetadataItem,
  CompiledMiddleware,
  ControllerInstance,
  ControllerMeta,
  GuardClass,
  GuardFunction,
  GuardInstance,
  Request,
  Response,
} from '../../types/core';
import type { ErrorHandler } from '../../types/core/error';
import { reflectMiddlewaresMetadata, reflectRouteMetadata, validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { handleCORS } from './cors';
import { getOrComputeFingerprint } from './fingerprint';
import { ForbiddenError } from './error';
import { getBodyAndMultipart, getParams, buildParamExtractor, extractMiddlewares } from './helper';
import { enforceRateLimit } from './ratelimit';
import { routeSpecificity } from './match';
import { sanitizeRequest } from './sanitize';

/**
 * Error codes that resolve to their own HTTP response and bypass `@Catch`
 * handlers — but only when the route declares no error handler of its own.
 */
export const SKIP_ERROR_HANDLER_CODES: (ErrorCode | undefined)[] = [
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.UNAUTHORIZED,
];

/**
 * Runs error handlers newest-first, stopping at the first that returns a
 * non-Error value (which becomes `response.data`). Returns true when a handler
 * produced such a value, false when every handler re-threw or returned an Error.
 */
async function runErrorHandlers(
  handlers: (ErrorHandler | undefined)[],
  error: unknown,
  request: Request,
  response: Response
): Promise<boolean> {
  let caught: unknown = error;
  for (const handler of handlers) {
    const resp = await Promise.resolve(handler?.(caught as Error, request, response)).catch(
      (err) => err
    );
    caught = resp;
    if (!(resp instanceof Error)) {
      response.data = caught;
      return true;
    }
  }
  return false;
}

export const execute = async (route: Route, request: Request, response: Response) => {
  request.params = route.compiledParamExtractor
    ? route.compiledParamExtractor(request.path)
    : getParams(route.route, request.path);

  const corsConfigs = route.compiled?.cors ?? route.cors ?? [];

  const handledCors = corsConfigs.reduce(
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
    const handled = await beforeRequest(request, response, route);

    if (handled) {
      return response;
    }

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
      if (param.type === 'fingerprint') {
        value = getOrComputeFingerprint(request);
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
      if (!response.isRedirect) {
        response.status =
          route.compiled?.status ?? route.functions.find((fn) => fn.status)?.status ?? 200;
      }
      if (route.compiled?.interceptors) {
        const interceptors = route.compiled.interceptors;
        for (let i = interceptors.length - 1; i >= 0; i--) {
          data = await Promise.resolve(interceptors[i](data, request, response));
        }
      } else {
        const interceptors = extractMiddlewares(route.functions, 'interceptor').reverse();
        for (const interceptor of interceptors) {
          data = await Promise.resolve(interceptor?.(data, request, response));
        }
      }
    }

    response.data = data;

    return response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    let caught = error;

    const compiledEH = route.compiled?.errorHandlers;
    const fallbackEH = compiledEH
      ? null
      : extractMiddlewares(route.functions, 'errorHandler').reverse();
    const handlerCount = compiledEH?.length ?? fallbackEH?.length ?? 0;

    // Errors with these codes carry their own HTTP semantics; skip @Catch only
    // when the route has no explicit error handler to override them.
    if (handlerCount === 0 && SKIP_ERROR_HANDLER_CODES.includes(error?.code)) {
      response.error(error);
      return response;
    }

    if (compiledEH) {
      for (let i = compiledEH.length - 1; i >= 0; i--) {
        const resp = await Promise.resolve(
          compiledEH[i]?.(caught as Error, request, response)
        ).catch((err) => err);
        caught = resp;
        if (resp instanceof Error) continue;
        response.data = caught;
        break;
      }
    } else if (fallbackEH) {
      for (const handler of fallbackEH) {
        const resp = await Promise.resolve(handler?.(caught as Error, request, response)).catch(
          (err) => err
        );
        caught = resp;
        if (resp instanceof Error) continue;
        response.data = caught;
        break;
      }
    }

    if (caught instanceof Error) {
      if (handlerCount === 0) {
        throw caught;
      }
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

  return Array.from(methods);
};

export const NextFunction = (error?: Error) => {
  if (error) throw error;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isGuardInstance(guard: any): guard is GuardInstance {
  return typeof guard === 'object' && guard !== null && typeof guard.canActivate === 'function';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isGuardClass(guard: any): guard is GuardClass {
  return (
    typeof guard === 'function' &&
    guard.prototype &&
    typeof guard.prototype.canActivate === 'function'
  );
}

export async function runGuard(
  guard: GuardInstance | GuardClass | GuardFunction,
  request: Request,
  response: Response
) {
  let canActivate;
  let message = 'Forbidden';
  if (isGuardInstance(guard)) {
    canActivate = await guard.canActivate(request, response);
    if (typeof canActivate === 'string') {
      message = canActivate;
      canActivate = false;
    } else {
      message = guard.message ?? message;
    }
  } else if (isGuardClass(guard)) {
    const guardInstance = new guard();
    canActivate = await guardInstance.canActivate(request, response);
    if (typeof canActivate === 'string') {
      message = canActivate;
      canActivate = false;
    } else {
      message = guardInstance.message ?? message;
    }
  } else {
    const result = await guard(request, response);
    if (typeof result === 'string') {
      canActivate = false;
      message = result;
    } else {
      canActivate = result;
    }
  }
  if (!canActivate) {
    throw new ForbiddenError(message);
  }
}

export const beforeRequest = async (
  request: Request,
  response: Response,
  route: Route
): Promise<boolean> => {
  await enforceRateLimit(request, response, route);

  const compiled = route.compiled;

  if (!compiled) {
    const handlers: ErrorHandler[] = [];
    try {
      for (const fn of route.functions) {
        if (fn.sanitizer) sanitizeRequest(request, fn.sanitizer);
        if (fn.guard) await runGuard(fn.guard, request, response);
        if (fn.pipe) {
          if (fn.pipe.body) request.body = fn.pipe.body(request.body, request);
          if (fn.pipe.query) request.query = fn.pipe.query(request.query, request);
          if (fn.pipe.params) request.params = fn.pipe.params(request.params, request);
          if (fn.pipe.headers) request.headers = fn.pipe.headers(request.headers, request);
        }
        if (fn.middleware) await fn.middleware(request, response, NextFunction);
        if (fn.errorHandler) handlers.unshift(fn.errorHandler);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (handlers.length === 0) throw err;
      if (await runErrorHandlers(handlers, err, request, response)) return true;
      throw err;
    }
    return false;
  }

  try {
    for (const sanitizer of compiled.sanitizers) {
      sanitizeRequest(request, sanitizer);
    }

    for (const guard of compiled.guards) {
      await runGuard(guard, request, response);
    }

    for (const pipe of compiled.pipes) {
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

    for (const mw of compiled.middlewares) {
      await mw(request, response, NextFunction);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (compiled.errorHandlers.length === 0) throw err;
    const ordered = [...compiled.errorHandlers].reverse();
    if (await runErrorHandlers(ordered, err, request, response)) return true;
    throw err;
  }
  return false;
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

    const allFunctions = [...meta.functions, ...functions];
    const corsConfigs = allFunctions
      .filter((fn) => fn.cors)
      .map((fn) => fn.cors as NonNullable<typeof fn.cors>);

    const compiledRegex = compileRouteRegex(current);

    routes.push({
      ...routeMeta,
      name,
      route: current,
      cors: corsConfigs.length > 0 ? corsConfigs : undefined,
      functions: allFunctions,
      fn: instance[name].bind(instance),
      compiledRegex,
      specificity: routeSpecificity(current),
      compiled: buildCompiledMiddleware(allFunctions),
      compiledParamExtractor: buildParamExtractor(current),
    });
  }

  return routes;
}

function compileRouteRegex(route: string): RegExp | undefined {
  const segments = route.split('/').filter((s) => s.length > 0);
  let pattern = '^';
  for (const seg of segments) {
    if (seg === '*') {
      pattern += '.*';
      continue;
    }
    const regexMatch = seg.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)\((.+)\)$/);
    if (regexMatch) {
      pattern += '/(' + regexMatch[2] + ')';
    } else if (seg.endsWith('?')) {
      pattern += '(?:/([^/]+))?';
    } else if (seg.startsWith(':')) {
      pattern += '/([^/]+)';
    } else {
      pattern += '/' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  pattern += '/?$';
  return new RegExp(pattern);
}

function buildCompiledMiddleware(fns: MiddlewaresMetadataItem[]): CompiledMiddleware {
  const compiled: CompiledMiddleware = {
    sanitizers: [],
    guards: [],
    pipes: [],
    middlewares: [],
    interceptors: [],
    errorHandlers: [],
    cors: [],
    rateLimits: [],
  };

  for (const fn of fns) {
    if (fn.sanitizer) compiled.sanitizers.push(fn.sanitizer);
    if (fn.guard) compiled.guards.push(fn.guard);
    if (fn.pipe) compiled.pipes.push(fn.pipe);
    if (fn.middleware) compiled.middlewares.push(fn.middleware);
    if (fn.interceptor) compiled.interceptors.push(fn.interceptor);
    if (fn.errorHandler) compiled.errorHandlers.push(fn.errorHandler);
    if (fn.cors) compiled.cors.push(fn.cors);
    if (fn.rateLimit) compiled.rateLimits.push(fn.rateLimit);
    if (fn.status !== undefined) compiled.status = fn.status;
  }

  return compiled;
}
