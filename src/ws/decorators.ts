import { WS_HANDLER, WS_TOPIC_KEY } from '@constants';
import { WebSocketHandlerType } from '@types';
import { createParamDecorator } from '@utils';

/**
 * Method decorator to handle WebSocket events.
 * @param type Type of WebSocket event (connection, message, close, error).
 * @param topic Optional topic for message filtering.
 */
export function OnWS(type: WebSocketHandlerType, topic?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = Reflect.getMetadata(WS_HANDLER, target.constructor) || [];
    handlers.push({ type, topic, method: propertyKey });
    Reflect.defineMetadata(WS_HANDLER, handlers, target.constructor);
    return descriptor;
  };
}

/**
 * Shortcut decorator for WebSocket connection event handler.
 */
export function OnConnection() {
  return OnWS('connection');
}

/**
 * Shortcut decorator for WebSocket message event handler.
 * @param topic Optional topic for message filtering.
 */
export function OnMessage(topic?: string) {
  return OnWS('message', topic);
}

/**
 * Shortcut decorator for WebSocket close event handler.
 */
export function OnClose() {
  return OnWS('close');
}

/**
 * Shortcut decorator for WebSocket error event handler.
 */
export function OnError() {
  return OnWS('error');
}

/**
 * Method decorator to subscribe to a WebSocket topic.
 * @param topic Topic name to subscribe.
 */
export function Subscribe(topic: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const topics = Reflect.getMetadata(WS_TOPIC_KEY, target.constructor) || [];
    topics.push({ topic, method: propertyKey });

    Reflect.defineMetadata(WS_TOPIC_KEY, topics, target.constructor);

    return descriptor;
  };
}

/**
 * Parameter decorator to inject WebSocket service instance.
 */
export function InjectWS() {
  return createParamDecorator('ws');
}
