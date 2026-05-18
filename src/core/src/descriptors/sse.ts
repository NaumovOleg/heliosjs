import type { IController, WsHandlerMeta } from '../types/core';
import {
  CONTROLLER_GET_SSE_HANDLERS,
  CONTROLLER_TYPED_HANDLERS,
  SSE_METADATA_KEY,
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

export const getSseHandlers = function (
  this: IController,
  type: string
) {
  const handlers = Reflect.getMetadata(SSE_METADATA_KEY, this.constructor) || [];

  return this[CONTROLLER_TYPED_HANDLERS](handlers, type);
};

export const lookupSse = function (this: IController) {
  const connection = this[CONTROLLER_GET_SSE_HANDLERS]('connection');
  const error = this[CONTROLLER_GET_SSE_HANDLERS]('error');
  const close = this[CONTROLLER_GET_SSE_HANDLERS]('close');

  if ([...connection, ...error, ...close].length === 0) {
    return;
  }

  this.sse = { handlers: { connection, close, error } };
};

export const getSseController = function (this: IController) {
  return {
    instance: this,
    handlers: {
      connection: this[CONTROLLER_GET_SSE_HANDLERS]('connection'),
      close: this[CONTROLLER_GET_SSE_HANDLERS]('close'),
      error: this[CONTROLLER_GET_SSE_HANDLERS]('error'),
    },
  };
};
