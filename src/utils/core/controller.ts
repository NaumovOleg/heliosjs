import 'reflect-metadata';
import {
  CORS_METADATA,
  ENDPOINT,
  MIDDLEWARES,
  OK_METADATA_KEY,
  OK_STATUSES,
  PARAM_METADATA_KEY,
  SANITIZE,
  TO_VALIDATE,
} from '../../constants';
import {
  ControllerInstance,
  ControllerMethods,
  CORSConfig,
  HeliosError,
  HTTP_METHODS,
  InterceptorCB,
  MiddlewareCB,
  ParamMetadata,
  Request,
  Response,
  SanitizerConfig,
} from '../../types/core';
import { validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { matchRoute } from './helper';
import { MultipartProcessor } from './multipart';
import { sanitizeRequest } from './sanitize';

const getBodyAndMultipart = (request: Request) => {
  let body = request.body;
  let multipart;
  if (MultipartProcessor.isMultipart({ headers: request.headers })) {
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

export const executeControllerMethod = async (
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

    const pathParams = matchRoute(current, route);

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

export const getResponse = async (data: {
  controllerInstance: ControllerInstance;
  name: string;
  interceptors: InterceptorCB[];
  request: Request;
  response: Response;
}) => {
  let appResponse = await executeControllerMethod(
    data.controllerInstance,
    data.name,
    data.request,
    data.response,
  );

  if (!appResponse) {
    return;
  }

  data.response.status = appResponse.status ?? 200;
  const isError = !OK_STATUSES.includes(data.response.status);
  const interceptors = data.interceptors.reverse();

  for (let index = 0; index < interceptors?.length && !isError; index++) {
    const interceptor = interceptors[index];
    appResponse = await Promise.resolve(interceptor(appResponse, data.request, data.response));
  }

  const propertyName = data.name;
  const prototype = Object.getPrototypeOf(data.controllerInstance);

  const methodOkStatus = Reflect.getMetadata(
    OK_METADATA_KEY,
    data.controllerInstance,
    propertyName,
  );

  if (!isError) {
    data.response.status = methodOkStatus ?? Reflect.getMetadata(OK_METADATA_KEY, prototype);
  }

  return appResponse;
};

export const applyMiddlewaresVsSanitizers = async (
  request: Request,
  response: Response,
  functions: {
    sanitizers: SanitizerConfig[][];
    middlewares: MiddlewareCB[][];
  },
) => {
  const length = Math.max(functions.sanitizers.length, functions.middlewares.length);

  for (let i = 0; i < length; i++) {
    const mws = functions.middlewares[i] ?? [];
    const sntzs = functions.sanitizers[i] ?? [];

    sanitizeRequest(request, sntzs);
    for (const middleware of mws) {
      await middleware(request, response, NextFunction);
    }
  }
};
