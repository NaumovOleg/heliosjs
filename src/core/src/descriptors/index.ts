import { request } from './request';
import { meta } from './meta';
import { typedHandlers, getWsHandlers, lookupWs, getWsTopics } from './ws';
import { getSseController, getSseHandlers, lookupSse } from './sse';

const properties = {
  getSseController,
  getSseHandlers,
  lookupSse,
  request,
  meta,
  typedHandlers,
  getWsHandlers,
  lookupWs,
  getWsTopics,
};

export default Object.fromEntries(
  Object.entries(properties).map(([key, fn]) => [
    key,
    { value: fn, writable: true, configurable: true },
  ])
);
