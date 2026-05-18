import { request } from './request';
import { meta } from './meta';
import { typedHandlers, getWsHandlers, lookupWs, getWsTopics } from './ws';
import { getSseController, getSseHandlers, lookupSse } from './sse';
import {
  CONTROLLER_GET_SSE_CONTROLLER,
  CONTROLLER_GET_SSE_HANDLERS,
  CONTROLLER_GET_WS_HANDLERS,
  CONTROLLER_GET_WS_TOPICS,
  CONTROLLER_LOOKUP_SSE,
  CONTROLLER_LOOKUP_WS,
  CONTROLLER_META,
  CONTROLLER_REQUEST,
  CONTROLLER_TYPED_HANDLERS,
} from '../constants';

export default {
  [CONTROLLER_GET_SSE_CONTROLLER]: {
    value: getSseController,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_GET_SSE_HANDLERS]: {
    value: getSseHandlers,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_LOOKUP_SSE]: {
    value: lookupSse,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_REQUEST]: {
    value: request,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_META]: {
    value: meta,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_TYPED_HANDLERS]: {
    value: typedHandlers,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_GET_WS_HANDLERS]: {
    value: getWsHandlers,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_LOOKUP_WS]: {
    value: lookupWs,
    writable: true,
    configurable: true,
  },
  [CONTROLLER_GET_WS_TOPICS]: {
    value: getWsTopics,
    writable: true,
    configurable: true,
  },
};
