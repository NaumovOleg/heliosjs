import {
  CORS_METADATA,
  ENDPOINT,
  MIDDLEWARES,
  OK_METADATA_KEY,
  OK_STATUSES,
  PARAM_METADATA_KEY,
  SANITIZE,
  TO_VALIDATE,
  WS_SERVICE_KEY,
} from '@constants';
import {
  AppRequest,
  ControllerInstance,
  ControllerMethods,
  CORSConfig,
  HTTP_METHODS,
  InterceptorCB,
  MiddlewareCB,
  ParamMetadata,
  SanitizerConfig,
} from '@types';
import { ServerResponse } from 'http';
import { WebSocketService } from '../app/http/websocket/WebsocketService';
import { matchRoute } from './helper';
import { MultipartProcessor } from './multipart';
import { sanitizeRequest } from './sanitize';
import { validate } from './validate';

const getBodyAndMultipart = (request: AppRequest) => {
  let body = request.body;
  let multipart;
  if (MultipartProcessor.isMultipart({ headers: request.headers })) {
    try {
      const { fields, files } = MultipartProcessor.parse({
        body: request.rawBody || request.body,
        headers: request.headers,
        isBase64Encoded: request.isBase64Encoded,
      });
      multipart = files;
      body = fields;
    } catch (error) {
      console.error('❌ Multipart parsing error:', error);
      throw { status: 400, message: 'Invalid multipart data' };
    }
  }

  return { multipart, body };
};

export const executeControllerMethod = async (
  controller: ControllerInstance,
  propertyName: string,
  request: AppRequest,
  response: ServerResponse,
) => {
  const fn = controller[propertyName];
  if (typeof fn !== 'function') return null;
  const endpointMeta = Reflect.getMetadata(ENDPOINT, controller, propertyName);
  if (!endpointMeta) return null;

  const methodMiddlewares: MiddlewareCB[] =
    Reflect.getMetadata(MIDDLEWARES, controller, propertyName) || [];

  for (let middleware of methodMiddlewares) {
    await middleware(request, response, NextFN);
  }

  const prototype = Object.getPrototypeOf(controller);
  const paramMetadata: ParamMetadata[] =
    Reflect.getMetadata(PARAM_METADATA_KEY, prototype, propertyName) || [];

  if (paramMetadata.length === 0) {
    return fn.call(controller, request, response);
  }

  const { body, multipart } = getBodyAndMultipart(request);

  const args: any[] = [];

  const wsParams = Reflect.getMetadata(WS_SERVICE_KEY, controller, propertyName) || [];
  const totalParams = Math.max(
    paramMetadata.length ? Math.max(...paramMetadata.map((p) => p.index)) + 1 : 0,
    wsParams.length ? Math.max(...wsParams.map((p: any) => p.index)) + 1 : 0,
  );

  for (let i = 0; i < totalParams; i++) {
    const wsParam = wsParams.find((p: any) => p.index === i);
    if (wsParam) {
      args[i] = WebSocketService.getInstance();
      continue;
    }

    const param = paramMetadata.find((p) => p.index === i);
    if (!param) {
      args[i] = undefined;
      continue;
    }

    let value = param.name
      ? request[param.type as keyof AppRequest]?.[param.name]
      : request[param.type as keyof AppRequest];

    if (param.type === 'multipart') {
      value = multipart;
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
      value = await validate(
        param.dto,
        typeof value === 'string' ? { [param.name ?? '']: value } : value,
      );
    }

    args[i] = value;
  }

  return fn.apply(controller, args);
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

  return methods.sort((a, b) => (a.httpMethod === HTTP_METHODS.USE ? 1 : -1));
};

export const getAllMethods = (obj: any): string[] => {
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
};

export const findRouteInController = (
  instance: any,
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

    if (httpMethod !== method && httpMethod !== 'USE') {
      continue;
    }

    if (httpMethod === 'USE') {
      let useRoute = route.split('/');
      useRoute.pop();
      route = useRoute.join('/');
    }
    const current = [path, routePattern].join('/').replace(/\/+/g, '/');

    const pathParams = matchRoute(current, route);

    if (pathParams) {
      const priority = httpMethod === 'USE' ? 0 : Object.keys(pathParams).length > 0 ? 1 : 2;

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

  return matches[0] || null;
};

export const NextFN = (error: any) => {
  if (error) throw { status: error.status ?? 500, message: error.message ?? error };
};

export const getResponse = async (data: {
  controllerInstance: ControllerInstance;
  name: string;
  interceptors: InterceptorCB[];
  request: AppRequest;
  response: ServerResponse;
}) => {
  try {
    let appResponse = await executeControllerMethod(
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
};

export const applyMiddlewaresVsSanitizers = async (
  request: AppRequest,
  response: ServerResponse,
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
    for (let middleware of mws) {
      await middleware(request, response, NextFN);
    }
  }
};
