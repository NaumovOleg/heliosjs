import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { typedHandlers, lookupSse, getSseController, getSseHandlers } from '../../../../src/core/src/descriptors/sse';
import { SSE_METADATA_KEY, CONTROLLER_TYPED_HANDLERS, CONTROLLER_GET_SSE_HANDLERS } from '../../../../src/core/src/constants';

describe('SSE typedHandlers', () => {
  it('filters handlers by type and binds methods', () => {
    const handlers = [
      { type: 'connection', method: 'onConnect', fn: () => {} },
      { type: 'error', method: 'onError', fn: () => {} },
      { type: 'message', method: 'onMessage', fn: () => {} },
    ];
    const controller = {
      onConnect: () => 'connected',
      onError: () => 'error',
      onMessage: () => 'msg',
    };

    const result = typedHandlers.call(controller as any, handlers, 'connection');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('connection');
    expect(result[0].fn()).toBe('connected');
  });

  it('returns empty array when no matching type', () => {
    const handlers = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    const result = typedHandlers.call({} as any, handlers, 'close');
    expect(result).toEqual([]);
  });
});

describe('getSseHandlers', () => {
  it('reads handlers from Reflect metadata', () => {
    const handlers = [
      { type: 'connection', method: 'onConnect', fn: () => {} },
    ];
    class Ctrl {
      onConnect() { return 'ok'; }
    }
    Reflect.defineMetadata(SSE_METADATA_KEY, handlers, Ctrl);

    const controller = {
      constructor: Ctrl,
      onConnect: () => 'ok',
    };
    (controller as any)[CONTROLLER_TYPED_HANDLERS] = function (hs: any[], type: string) {
      return typedHandlers.call(controller, hs, type);
    };

    const result = getSseHandlers.call(controller as any, 'connection');
    expect(result).toHaveLength(1);
  });

  it('returns empty when no metadata', () => {
    class Ctrl {}
    const controller = { constructor: Ctrl };
    (controller as any)[CONTROLLER_TYPED_HANDLERS] = function (hs: any[], type: string) {
      return typedHandlers.call(controller, hs, type);
    };

    const result = getSseHandlers.call(controller as any, 'connection');
    expect(result).toEqual([]);
  });
});

describe('lookupSse', () => {
  it('sets this.sse when handlers exist', () => {
    const connection = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    const controller: any = {
      [CONTROLLER_GET_SSE_HANDLERS]: (type: string) => {
        if (type === 'connection') return connection;
        return [];
      },
    };

    lookupSse.call(controller);
    expect(controller.sse).toBeDefined();
    expect(controller.sse.handlers.connection).toBe(connection);
    expect(controller.sse.handlers.error).toEqual([]);
    expect(controller.sse.handlers.close).toEqual([]);
  });

  it('does not set this.sse when no handlers', () => {
    const controller: any = {
      [CONTROLLER_GET_SSE_HANDLERS]: () => [],
    };

    lookupSse.call(controller);
    expect(controller.sse).toBeUndefined();
  });
});

describe('getSseController', () => {
  it('returns instance and handlers', () => {
    const connection = [{ type: 'connection', method: 'onConnect', fn: () => {} }];
    const controller: any = {
      [CONTROLLER_GET_SSE_HANDLERS]: (type: string) => {
        if (type === 'connection') return connection;
        return [];
      },
    };

    const result = getSseController.call(controller);
    expect(result.instance).toBe(controller);
    expect(result.handlers.connection).toBe(connection);
    expect(result.handlers.close).toEqual([]);
    expect(result.handlers.error).toEqual([]);
  });
});
