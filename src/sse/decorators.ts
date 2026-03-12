import { SSE_METADATA_KEY } from '@constants';
import { createParamDecorator } from '@utils';

export type SSEHandlerType = 'connection' | 'close' | 'error';

export function OnSSE(type: SSEHandlerType) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = Reflect.getMetadata(SSE_METADATA_KEY, target.constructor) || [];
    handlers.push({ type, method: propertyKey });
    Reflect.defineMetadata(SSE_METADATA_KEY, handlers, target.constructor);
    return descriptor;
  };
}

export function OnSSEConnection() {
  return OnSSE('connection');
}

export function OnSSEClose() {
  return OnSSE('close');
}

export function OnSSEError() {
  return OnSSE('error');
}

export function InjectSSE() {
  return createParamDecorator('sse');
}
