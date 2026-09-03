import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { typedHandlers, getWsHandlers, getWsTopics, lookupWs } from '../../../../src/core/src/descriptors/ws';
import { WS_HANDLER, WS_TOPIC_KEY, CONTROLLER_TYPED_HANDLERS, CONTROLLER_GET_WS_HANDLERS } from '../../../../src/core/src/constants';

describe('WS typedHandlers', () => {
  it('filters handlers by type and binds methods', () => {
    const handlers = [
      { type: 'connection', method: 'onConnect', fn: () => {} },
      { type: 'message', method: 'onMessage', fn: () => {} },
      { type: 'error', method: 'onError', fn: () => {} },
    ];
    const controller = {
      onConnect: () => 'connected',
      onMessage: () => 'msg',
      onError: () => 'err',
    };

    const result = typedHandlers.call(controller as any, handlers, 'message');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('message');
    expect(result[0].fn()).toBe('msg');
  });

  it('returns empty array when no matching type', () => {
    const handlers = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    const result = typedHandlers.call({} as any, handlers, 'close');
    expect(result).toEqual([]);
  });

  it('returns multiple handlers of same type', () => {
    const handlers = [
      { type: 'message', method: 'onMsg1', fn: () => {} },
      { type: 'message', method: 'onMsg2', fn: () => {} },
    ];
    const controller = { onMsg1: () => 1, onMsg2: () => 2 };
    const result = typedHandlers.call(controller as any, handlers, 'message');
    expect(result).toHaveLength(2);
  });
});

describe('getWsHandlers', () => {
  it('reads handlers from Reflect metadata', () => {
    const handlers = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    class WsCtrl {}
    Reflect.defineMetadata(WS_HANDLER, handlers, WsCtrl);

    const controller: any = {
      constructor: WsCtrl,
      onConnect: () => 'connected',
    };
    controller[CONTROLLER_TYPED_HANDLERS] = (hs: any[], type: string) =>
      typedHandlers.call(controller, hs, type);

    const result = getWsHandlers.call(controller, 'connection');
    expect(result).toHaveLength(1);
    expect(result[0].fn()).toBe('connected');
  });

  it('returns empty when no metadata', () => {
    class WsCtrl {}
    const controller: any = {
      constructor: WsCtrl,
      onConnect: () => {},
    };
    controller[CONTROLLER_TYPED_HANDLERS] = (hs: any[], type: string) =>
      typedHandlers.call(controller, hs, type);

    const result = getWsHandlers.call(controller, 'connection');
    expect(result).toEqual([]);
  });
});

describe('getWsTopics', () => {
  it('reads topics from Reflect metadata and binds methods', () => {
    const topics = [{ topic: 'chat', method: 'onChat' }];
    class WsCtrl {}
    Reflect.defineMetadata(WS_TOPIC_KEY, topics, WsCtrl);

    const controller: any = {
      constructor: WsCtrl,
      onChat: () => 'chat-msg',
    };

    const result = getWsTopics.call(controller);
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe('chat');
    expect(result[0].fn()).toBe('chat-msg');
  });

  it('returns empty when no metadata', () => {
    class WsCtrl {}
    const controller: any = { constructor: WsCtrl };
    expect(getWsTopics.call(controller)).toEqual([]);
  });
});

describe('lookupWs', () => {
  it('sets this.websocket when handlers exist', () => {
    const connection = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    const controller: any = {
      [CONTROLLER_GET_WS_HANDLERS]: (type: string) => {
        if (type === 'connection') return connection;
        return [];
      },
    };

    lookupWs.call(controller);
    expect(controller.websocket).toBeDefined();
    expect(controller.websocket.handlers.connection).toBe(connection);
    expect(controller.websocket.handlers.message).toEqual([]);
    expect(controller.websocket.topics).toEqual([]);
  });

  it('does not set this.websocket when no handlers', () => {
    const controller: any = {
      [CONTROLLER_GET_WS_HANDLERS]: () => [],
    };

    lookupWs.call(controller);
    expect(controller.websocket).toBeUndefined();
  });
});
