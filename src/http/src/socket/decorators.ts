import { WS_HANDLER, WS_TOPIC_KEY } from '@heliosjs/core/constants';
import type { WebSocketHandlerType } from '@heliosjs/core/types';
import { createParamDecorator } from '@heliosjs/core/utils';

/**
 * Method decorator that binds a controller method to a WebSocket lifecycle event.
 * Requires WebSocket to be enabled on the server (`websocket: { path, controllers }`)
 * and the controller listed among `websocket.controllers`.
 *
 * @param type - Which event to handle, a `WebSocketHandlerType`:
 *   - `'connection'` — a client completed the WS handshake;
 *   - `'message'` — a client sent a frame (optionally filtered by `topic`);
 *   - `'close'` — a client disconnected;
 *   - `'error'` — the socket errored.
 *   Why: one handler per phase of the connection.
 * @param topic - For `'message'` only: deliver just the messages whose `topic`
 *   field matches. Omit to receive every message. Why: route chat/feed
 *   namespaces to different handlers.
 *
 * @example
 * @OnWS('message', 'chat')
 * onChat(@InjectWS() ws: WebSocketService, msg: WebSocketMessage) {}
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
 * Shortcut for `@OnWS('connection')` — fires when a client completes the
 * WebSocket handshake.
 *
 * @example
 * @OnConnection()
 * onConnect() {}
 */
export function OnConnection() {
  return OnWS('connection');
}

/**
 * Shortcut for `@OnWS('message', topic)` — fires on each inbound frame.
 *
 * @param topic - Optional message `topic` to filter on; omit to receive all
 *   messages.
 *
 * @example
 * @OnMessage('chat')
 * onChatMessage(msg: WebSocketMessage) {}
 */
export function OnMessage(topic?: string) {
  return OnWS('message', topic);
}

/**
 * Shortcut for `@OnWS('close')` — fires when a client disconnects.
 *
 * @example
 * @OnClose()
 * onClose() {}
 */
export function OnClose() {
  return OnWS('close');
}

/**
 * Shortcut for `@OnWS('error')` — fires when a client's socket errors.
 *
 * @example
 * @OnError()
 * onError() {}
 */
export function OnError() {
  return OnWS('error');
}

/**
 * Method decorator that auto-subscribes new connections to a WebSocket topic and
 * routes that topic's published messages to the decorated method. Complements
 * `@OnMessage(topic)` (which only receives) by also joining the topic.
 *
 * @param topic - Topic name to subscribe the connection to. Why: server-driven
 *   fan-out (news feed, presence) without the client sending a subscribe frame.
 *
 * @example
 * @Subscribe('news')
 * onNews(data: unknown) {}
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
 * Parameter decorator that injects the singleton `WebSocketService`, used to push
 * data to clients (`sendToClient`, `publishToTopic`, `broadcast`), inspect
 * `getStats()`, and check `isAvailable()`. Works in both WS handlers and regular
 * HTTP handlers (e.g. to notify sockets from a REST endpoint).
 *
 * @example
 * @Post('/broadcast')
 * announce(@InjectWS() ws: WebSocketService, @Body('text') text: string) {
 *   ws.broadcast({ type: 'announce', data: text });
 * }
 */
export function InjectWS() {
  return createParamDecorator('ws');
}
