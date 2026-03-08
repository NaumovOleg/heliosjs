import { ControllerInstance, Middleware, ParamMetadata } from '@types';
import { MultipartProcessor } from '@utils';
import { WebSocketService } from '../app/http/websocket/WebsocetService';
import { validate } from './validate';

import { ENDPOINT, MIDDLEWARES, PARAM_METADATA_KEY, TO_VALIDATE, WS_SERVICE_KEY } from '@constants';
import { ServerResponse } from 'http';

const getBodyAndMultipart = (payload: any) => {
  let body = payload.body;
  let multipart;
  if (MultipartProcessor.isMultipart({ headers: payload.headers })) {
    try {
      const { fields, files } = MultipartProcessor.parse({
        body: payload.rawBody || payload.body,
        headers: payload.headers,
        isBase64Encoded: payload.isBase64Encoded,
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
  payload: any,
  response?: ServerResponse,
) => {
  const fn = controller[propertyName];
  if (typeof fn !== 'function') return null;
  const endpointMeta = Reflect.getMetadata(ENDPOINT, controller, propertyName);
  if (!endpointMeta) return null;

  const methodMiddlewares: Middleware[] =
    Reflect.getMetadata(MIDDLEWARES, controller, propertyName) || [];

  for (let i = 0; i < methodMiddlewares.length; i++) {
    const middleware = methodMiddlewares[i];
    const result = await middleware(payload);
    if (result) {
      payload = { ...payload, ...result };
    }
  }

  const prototype = Object.getPrototypeOf(controller);
  const paramMetadata: ParamMetadata[] =
    Reflect.getMetadata(PARAM_METADATA_KEY, prototype, propertyName) || [];

  const { body, multipart } = getBodyAndMultipart(payload);
  if (paramMetadata.length === 0) {
    return fn.call(controller, payload);
  }

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

    let value = param.name ? payload[param.type]?.[param.name] : payload[param.type];

    if (param.type === 'multipart') {
      value = multipart;
    }
    if (param.type === 'request') {
      value = payload;
    }
    if (param.type === 'response') {
      value = response;
    }
    if (param.type === 'response') {
      value = response;
    }
    if (param.type === 'body') {
      value = body;
    }

    if (TO_VALIDATE.includes(param.type)) {
      value = await validate(param.dto, value);
    }

    args[i] = value;
  }

  return fn.apply(controller, args);
};

export const getControllerMethods = (controller: ControllerInstance) => {
  const methods: Array<{
    name: string;
    httpMethod: string;
    pattern: string;
    middlewares?: Array<(req: any, res?: ServerResponse) => any>;
  }> = [];

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

  return methods;
};
