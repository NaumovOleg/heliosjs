import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { OnWS, OnConnection, OnMessage, OnClose, OnError, Subscribe, InjectWS } from '@heliosjs/http';
import { WS_HANDLER, WS_TOPIC_KEY } from '@heliosjs/core/constants';

describe('WebSocket decorators', () => {
  describe('@OnWS', () => {
    it('registers connection handler', () => {
      class Ctrl {
        @OnWS('connection')
        onConnect() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].type).toBe('connection');
      expect(handlers[0].method).toBe('onConnect');
    });

    it('registers message handler with topic', () => {
      class Ctrl {
        @OnWS('message', 'chat')
        onChat() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].type).toBe('message');
      expect(handlers[0].topic).toBe('chat');
    });

    it('accumulates multiple handlers', () => {
      class Ctrl {
        @OnWS('connection')
        onConnect() {}

        @OnWS('message')
        onMsg() {}

        @OnWS('close')
        onClose() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers).toHaveLength(3);
    });

    it('returns descriptor', () => {
      class Ctrl {
        @OnWS('connection')
        handler() {}
      }
      expect(Ctrl.prototype.handler).toBeDefined();
    });
  });

  describe('shortcut decorators', () => {
    it('@OnConnection registers connection handler', () => {
      class Ctrl {
        @OnConnection()
        onConnect() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].type).toBe('connection');
    });

    it('@OnMessage registers message handler', () => {
      class Ctrl {
        @OnMessage('news')
        onNews() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].type).toBe('message');
      expect(handlers[0].topic).toBe('news');
    });

    it('@OnMessage without topic', () => {
      class Ctrl {
        @OnMessage()
        onMsg() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].topic).toBeUndefined();
    });

    it('@OnClose registers close handler', () => {
      class Ctrl {
        @OnClose()
        onClose() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].type).toBe('close');
    });

    it('@OnError registers error handler', () => {
      class Ctrl {
        @OnError()
        onError() {}
      }
      const handlers = Reflect.getMetadata(WS_HANDLER, Ctrl);
      expect(handlers[0].type).toBe('error');
    });
  });

  describe('@Subscribe', () => {
    it('registers topic subscription', () => {
      class Ctrl {
        @Subscribe('news')
        onNews() {}
      }
      const topics = Reflect.getMetadata(WS_TOPIC_KEY, Ctrl);
      expect(topics).toHaveLength(1);
      expect(topics[0].topic).toBe('news');
      expect(topics[0].method).toBe('onNews');
    });

    it('accumulates multiple subscriptions', () => {
      class Ctrl {
        @Subscribe('news')
        onNews() {}

        @Subscribe('sports')
        onSports() {}
      }
      const topics = Reflect.getMetadata(WS_TOPIC_KEY, Ctrl);
      expect(topics).toHaveLength(2);
    });
  });

  describe('@InjectWS', () => {
    it('creates ws parameter decorator', () => {
      class Ctrl {
        handler(@InjectWS() ws: any) {}
      }
      const meta = Reflect.getMetadata('controller:route', Ctrl.prototype, 'handler');
      expect(meta.parameters).toHaveLength(1);
      expect(meta.parameters[0].type).toBe('ws');
    });
  });
});
