import { ControllerInstance, Middleware, ParamMetadata } from '@types';
import { transformAndValidate } from './transform';

import { ENDPOINT, MIDDLEWARES, PARAM_METADATA_KEY } from '@constants';

export const executeControllerMethod = async (
  controller: ControllerInstance,
  propertyName: string,
  payload: any,
) => {
  const fn = controller[propertyName];
  if (typeof fn !== 'function') return null;
  const endpointMeta = Reflect.getMetadata(ENDPOINT, controller, propertyName);
  if (!endpointMeta) return null;

  const methodMiddlewares: Middleware[] =
    Reflect.getMetadata(MIDDLEWARES, controller, propertyName) || [];

  let processedPayload = { ...payload };
  for (let i = 0; i < methodMiddlewares.length; i++) {
    const middleware = methodMiddlewares[i];
    const result = await middleware(processedPayload);
    if (result) {
      processedPayload = { ...processedPayload, ...result };
    }
  }

  const prototype = Object.getPrototypeOf(controller);
  const paramMetadata: ParamMetadata[] =
    Reflect.getMetadata(PARAM_METADATA_KEY, prototype, propertyName) || [];

  if (paramMetadata.length === 0) {
    return fn.call(controller, processedPayload);
  }

  const args: any[] = [];

  for (const param of paramMetadata) {
    let value: any;

    switch (param.type) {
      case 'body':
        value = await transformAndValidate(param.dto, processedPayload.body);
        break;
      case 'params':
        value = param.name ? processedPayload.params?.[param.name] : processedPayload.params;
        break;
      case 'query':
        value = param.name ? processedPayload.query?.[param.name] : processedPayload.query;
        break;
      case 'request':
        value = processedPayload;
        break;

      case 'headers':
        value = param.name ? processedPayload.headers?.[param.name] : processedPayload.headers;
        break;

      case 'cookies':
        value = param.name ? processedPayload.cookies?.[param.name] : processedPayload.cookies;
        break;
    }

    args.push(value);
  }

  return fn.apply(controller, args);
};

export const getControllerMethods = (controller: ControllerInstance) => {
  const methods: Array<{
    name: string;
    httpMethod: string;
    pattern: string;
    middlewares?: Array<(Request: any) => any>;
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
