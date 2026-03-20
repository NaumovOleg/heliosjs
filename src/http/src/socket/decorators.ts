import { WS_HANDLER, WS_TOPIC_KEY } from '../constants';
import { WebSocketHandlerType } from '../types/ws';
import { createParamDecorator } from '../utils/core';

/**
 * Method decorator to handle WebSocket events.
 *
 * @param {WebSocketHandlerType} type - Type of WebSocket event (connection, message, close, error).
 * @param {string} [topic] - Optional topic for message filtering.
 *
 * Usage:
 * ```ts
 * @OnWS('message', 'chat')
 * onMessage(msg) {}
 * ```
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
 *
 * Usage:
 * ```ts
 * @OnConnection()
 * onConnect() {}
 * ```
 */
export function OnConnection() {
  return OnWS('connection');
}

/**
 * Shortcut decorator for WebSocket message event handler.
 *
 * @param {string} [topic] - Optional topic for message filtering.
 *
 * Usage:
 * ```ts
 * @OnMessage('chat')
 * onChatMessage(msg) {}
 * ```
 */
export function OnMessage(topic?: string) {
  return OnWS('message', topic);
}

/**
 * Shortcut decorator for WebSocket close event handler.
 *
 * Usage:
 * ```ts
 * @OnClose()
 * onClose() {}
 * ```
 */
export function OnClose() {
  return OnWS('close');
}

/**
 * Shortcut decorator for WebSocket error event handler.
 *
 * Usage:
 * ```ts
 * @OnError()
 * onError() {}
 * ```
 */
export function OnError() {
  return OnWS('error');
}

/**
 * Method decorator to subscribe to a WebSocket topic.
 *
 * @param {string} topic - Topic name to subscribe.
 *
 * Usage:
 * ```ts
 * @Subscribe('news')
 * onNews(data) {}
 * ```
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
 *
 * Usage:
 * ```ts
 * someMethod(@InjectWS() ws) {}
 * ```
 */
export function InjectWS() {
  return createParamDecorator('ws');
}
