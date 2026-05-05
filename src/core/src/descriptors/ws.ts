import type { IController, WsHandlerMeta } from '../types/core';
import { WS_HANDLER, WS_TOPIC_KEY } from '../constants';

export const typedHandlers: IController['typedHandlers'] = function (
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

export const getWsHandlers: IController['getWsHandlers'] = function (
  this: IController,
  type: string
) {
  const handlers = Reflect.getMetadata(WS_HANDLER, this.constructor) || [];
  return this.typedHandlers(handlers, type);
};
export const getWsTopics: IController['getWsTopics'] = function (this: IController) {
  const topics = Reflect.getMetadata(WS_TOPIC_KEY, this.constructor) || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return topics.map((t: any) => ({
    ...t,
    fn: (this[t.method as keyof IController] as () => void).bind(this),
  }));
};

export const lookupWs: IController['lookupWs'] = function (this: IController) {
  const connection = this.getWsHandlers('connection');
  const message = this.getWsHandlers('message');
  const error = this.getWsHandlers('error');
  const close = this.getWsHandlers('close');
  const topics = this.getWsHandlers('topics');

  if ([...connection, ...message, ...error, ...close, ...topics].length === 0) {
    return;
  }

  this.websocket = { handlers: { connection, message, close, error }, topics };
};
