import {
  CORS_METADATA,
  ENDPOINT,
  MIDDLEWARES,
  PARAM_METADATA_KEY,
  TO_VALIDATE,
  USE_MIDDLEWARE,
  WS_SERVICE_KEY,
} from '@constants';
import {
  AppRequest,
  ControllerInstance,
  ControllerMethods,
  CORSConfig,
  HTTP_METHODS,
  MiddlewareCB,
  ParamMetadata,
} from '@types';
import { ServerResponse } from 'http';
import { WebSocketService } from '../app/http/websocket/WebsocketService';
import { matchRoute } from './helper';
import { MultipartProcessor } from './multipart';
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
    methodMiddlewares: MiddlewareCB[];
    cors?: CORSConfig;
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

    const pathParams = matchRoute(current, route);

    if (pathParams) {
      const priority = httpMethod === 'USE' ? 0 : Object.keys(pathParams).length > 0 ? 1 : 2;
      const methodMiddlewares = []
        .concat(Reflect.getMetadata(MIDDLEWARES, prototype))
        .concat(Reflect.getMetadata(USE_MIDDLEWARE, prototype))
        .filter((el) => !!el);

      matches.push({
        name,
        pathParams,
        priority,
        cors: Reflect.getMetadata(CORS_METADATA, prototype, name),
        methodMiddlewares,
      });
    }
  }

  matches.sort((a, b) => b.priority - a.priority);

  return matches[0] || null;
};

export const NextFN = (error: any) => {
  if (error) throw { status: error.status ?? 500, message: error.message ?? error };
};
