import 'reflect-metadata';
import {
  CORS_METADATA,
  ENDPOINT,
  MIDDLEWARES,
  OK_METADATA_KEY,
  PARAM_METADATA_KEY,
  SANITIZE,
  TO_VALIDATE,
} from '../../constants';
import {
  ControllerInstance,
  ControllerMeta,
  ControllerMethods,
  CORSConfig,
  ErorrHandler,
  HeliosError,
  HTTP_METHODS,
  MiddlewareCB,
  ParamMetadata,
  Request,
  Response,
  Route,
  SanitizerConfig,
} from '../../types/core';
import { validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { handleCORS } from './cors';
import { ForbiddenError } from './error';
import { getParams } from './helper';
import { MultipartProcessor } from './multipart';
import { sanitizeRequest } from './sanitize';

const getBodyAndMultipart = (request: Request) => {
  let body = request.body;
  let multipart;
  if (MultipartProcessor.isMultipart(request)) {
    const { fields, files } = MultipartProcessor.parse({
      body: request.rawBody || request.body,
      headers: request.headers,
      isBase64Encoded: request.isBase64Encoded,
    });
    multipart = files;
    body = fields;
  }

  return { multipart, body };
};

export const executeControllerMethods = async (
  controller: ControllerInstance,
  propertyName: string,
  request: Request,
  response: Response,
) => {
  const fn = controller[propertyName];
  if (typeof fn !== 'function') return null;
  const endpointMeta = Reflect.getMetadata(ENDPOINT, controller, propertyName);
  if (!endpointMeta) return null;

  const methodMiddlewares: MiddlewareCB[] =
    Reflect.getMetadata(MIDDLEWARES, controller, propertyName) || [];

  try {
    for (const middleware of methodMiddlewares) {
      await middleware(request, response, NextFunction);
    }

    const prototype = Object.getPrototypeOf(controller);
    const paramMetadata: ParamMetadata[] =
      Reflect.getMetadata(PARAM_METADATA_KEY, prototype, propertyName) || [];

    if (paramMetadata.length === 0) {
      return fn.call(controller, request, response);
    }

    const { body, multipart } = getBodyAndMultipart(request);

    const args: unknown[] = [];

    const totalParams = Math.max(
      paramMetadata.length ? Math.max(...paramMetadata.map((p) => p.index)) + 1 : 0,
    );

    for (let i = 0; i < totalParams; i++) {
      const param = paramMetadata.find((p) => p.index === i);

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

    return await fn.apply(controller, args);
  } catch (error) {
    if (typeof error === 'string') {
      const catched = new Error(error);
      const errorData = {
        stack: `${catched.name}: ${catched.message}\n    at ${controller.constructor?.name}.${propertyName}\n${catched.stack}`,
        original: error,
        controller: controller.constructor?.name,
        method: propertyName,
        status: 500,
      };
      Object.assign(catched, errorData);

      response.error(catched);

      throw catched;
    }

    throw error;
  }
};

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
    await applyMiddlewaresVsSanitizers(request, response, route);

    const { body, multipart } = getBodyAndMultipart(request);

    const args: unknown[] = [];

    const totalParams = Math.max(
      route.paramMetadata.length ? Math.max(...route.paramMetadata.map((p) => p.index)) + 1 : 0,
    );

    for (let i = 0; i < totalParams; i++) {
      const param = route.paramMetadata.find((p) => p.index === i);

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
      for (const interceptor of route.interceptors) {
        data = await Promise.resolve(interceptor(data, data.request, data.response));
      }
    }

    response.data = data;

    return response;
  } catch (error) {
    let catched = error;
    for (const functions of route.functions) {
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

  return Array.from(methods);
};

export const findRouteInController = (
  instance: ControllerInstance,
  path: string,
  route: string,
  method: string,
) => {
  const prototype = Object.getPrototypeOf(instance);
  const propertyNames = getAllMethods(instance);

  const matches: Array<{
    name: string;
    pathParams: Record<string, string>;
    priority: number;
    middlewares: MiddlewareCB[];
    cors?: CORSConfig;
    sanitizers: SanitizerConfig[];
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
    const sanitizers = Reflect.getMetadata(SANITIZE, prototype, name) ?? [];
    if (endpointMeta.length === 0) continue;

    const [httpMethod, routePattern, middlewares] = endpointMeta;

    if (httpMethod !== method && httpMethod !== 'ANY') {
      continue;
    }

    if (httpMethod === 'ANY') {
      const useRoute = route.split('/');

      route = useRoute[0];
    }

    const current = [path, routePattern].join('/').replace(/\/+/g, '/');

    const pathParams = getParams(current, route);

    if (pathParams) {
      const priority = httpMethod === 'ANY' ? 0 : Object.keys(pathParams).length > 0 ? 1 : 2;

      matches.push({
        name,
        pathParams,
        priority,
        cors: Reflect.getMetadata(CORS_METADATA, prototype, name),
        middlewares,
        sanitizers,
      });
    }
  }

  matches.sort((a, b) => b.priority - a.priority);

  return matches[0];
};

export const NextFunction = (error?: HeliosError) => {
  if (error) throw { status: error.status ?? 500, message: error.message ?? error };
};

export const applyMiddlewaresVsSanitizers = async (
  request: Request,
  response: Response,
  route: Route,
) => {
  const handlers: ErorrHandler[] = [];
  try {
    for (const batch of route.functions) {
      sanitizeRequest(request, batch.sanitizers);
      handlers.unshift(...batch.errors);

      for (const middleware of batch.middlewares) {
        await middleware(request, response, NextFunction);
      }
    }
  } catch (err: any) {
    const promises = handlers.map((handler) => handler(err, request, response));

    return Promise.all(promises).catch((err) => err);
  }
};

export const collectRoutes = (
  instance: ControllerInstance,
  meta: ControllerMeta,
  prefix: string = '/',
) => {
  const prototype = Object.getPrototypeOf(instance);
  const propertyNames = getAllMethods(instance);

  const routes: Route[] = [];

  for (const name of propertyNames) {
    if (
      [
        'constructor',
        'meta',
        'getResponse',
        'routeWalker',
        'getAllMethods',
        'findRouteInController',
      ].includes(name)
    )
      continue;

    const endpointMeta = Reflect.getMetadata(ENDPOINT, prototype, name) || [];
    const sanitizer = Reflect.getMetadata(SANITIZE, prototype, name);
    const paramMetadata = Reflect.getMetadata(PARAM_METADATA_KEY, prototype, name) || [];
    const ok = Reflect.getMetadata(OK_METADATA_KEY, prototype, name);
    if (endpointMeta.length === 0) continue;

    const [method, route, middlewares = []] = endpointMeta;
    const current = [prefix, route].join('/').replace(/\/+/g, '/');

    const functions = {
      errors: [],
      sanitizers: sanitizer ? [sanitizer] : [],
      middlewares,
    };

    routes.push({
      name,
      route: current,
      method,
      paramMetadata,
      cors: [...meta.cors, Reflect.getMetadata(CORS_METADATA, prototype, name)].filter(
        (el) => !!el,
      ),
      ok: ok ?? 200,
      interceptors: meta.interceptors,
      functions: [...meta.functions, functions],
      fn: instance[name].bind(instance),
    });
  }

  return routes;
};
