import type { IController, WsHandlerMeta } from '../types/core';
import {
  CONTROLLER_GET_WS_HANDLERS,
  CONTROLLER_TYPED_HANDLERS,
  WS_HANDLER,
  WS_TOPIC_KEY,
} from '../constants';

export const typedHandlers = function (
  this: IController,
  handlers: WsHandlerMeta[],
  type: string
) {
  const resp = handlers
    .filter((h) => h.type === type)
    .map((h) => ({
      ...h,
      fn: (this[h.method as keyof IController] as () => void).bind(this),
    }));

  return resp;
};

export const getWsHandlers = function (
  this: IController,
  type: string
) {
  const handlers = Reflect.getMetadata(WS_HANDLER, this.constructor) || [];
  return this[CONTROLLER_TYPED_HANDLERS](handlers, type);
};
export const getWsTopics = function (this: IController) {
  const topics = Reflect.getMetadata(WS_TOPIC_KEY, this.constructor) || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return topics.map((t: any) => ({
    ...t,
    fn: (this[t.method as keyof IController] as () => void).bind(this),
  }));
};

export const lookupWs = function (this: IController) {
  const connection = this[CONTROLLER_GET_WS_HANDLERS]('connection');
  const message = this[CONTROLLER_GET_WS_HANDLERS]('message');
  const error = this[CONTROLLER_GET_WS_HANDLERS]('error');
  const close = this[CONTROLLER_GET_WS_HANDLERS]('close');
  const topics = this[CONTROLLER_GET_WS_HANDLERS]('topics');

  if ([...connection, ...message, ...error, ...close, ...topics].length === 0) {
    return;
  }

  this.websocket = { handlers: { connection, message, close, error }, topics };
};
