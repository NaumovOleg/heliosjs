import type { IController, WsHandlerMeta } from '../types/core';
import { SSE_METADATA_KEY } from '../constants';

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

export const getSseHandlers: IController['getSseHandlers'] = function (
  this: IController,
  type: string
) {
  const handlers = Reflect.getMetadata(SSE_METADATA_KEY, this.constructor) || [];

  return this.typedHandlers(handlers, type);
};

export const lookupSse: IController['lookupSse'] = function (this: IController) {
  const connection = this.getSseHandlers('connection');
  const error = this.getSseHandlers('error');
  const close = this.getSseHandlers('close');

  if ([...connection, ...error, ...close].length === 0) {
    return;
  }

  this.sse = { handlers: { connection, close, error } };
};

export const getSseController: IController['getSseController'] = function (this: IController) {
  return {
    instance: this,
    handlers: {
      connection: this.getSseHandlers('connection'),
      close: this.getSseHandlers('close'),
      error: this.getSseHandlers('error'),
    },
  };
};
