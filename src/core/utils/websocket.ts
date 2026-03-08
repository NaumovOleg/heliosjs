import { WS_METADATA_KEY, WS_SERVICE_KEY, WS_TOPIC_KEY } from '@constants';

import { WebSocketHandlerType } from '@types';

export function OnWS(type: WebSocketHandlerType, topic?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = Reflect.getMetadata(WS_METADATA_KEY, target.constructor) || [];
    handlers.push({ type, topic, method: propertyKey });
    Reflect.defineMetadata(WS_METADATA_KEY, handlers, target.constructor);
    return descriptor;
  };
}

export function OnConnection() {
  return OnWS('connection');
}

export function OnMessage(topic?: string) {
  return OnWS('message', topic);
}

export function OnClose() {
  return OnWS('close');
}

export function OnError() {
  return OnWS('error');
}

export function Subscribe(topic: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const topics = Reflect.getMetadata(WS_TOPIC_KEY, target.constructor) || [];
    topics.push({ topic, method: propertyKey });
    Reflect.defineMetadata(WS_TOPIC_KEY, topics, target.constructor);
    return descriptor;
  };
}

export function InjectWS() {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingParams = Reflect.getMetadata(WS_SERVICE_KEY, target, propertyKey) || [];
    existingParams.push({ index: parameterIndex });
    Reflect.defineMetadata(WS_SERVICE_KEY, existingParams, target, propertyKey);
  };
}
