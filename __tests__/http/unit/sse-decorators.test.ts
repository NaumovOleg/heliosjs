import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { OnSSE, OnSSEConnection, OnSSEClose, OnSSEError, InjectSSE } from '@heliosjs/http';
import { SSE_METADATA_KEY } from '@heliosjs/core/constants';

describe('SSE decorators', () => {
  describe('@OnSSE', () => {
    it('registers connection handler', () => {
      class Ctrl {
        @OnSSE('connection')
        onConnect() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].type).toBe('connection');
      expect(handlers[0].method).toBe('onConnect');
    });

    it('registers close handler', () => {
      class Ctrl {
        @OnSSE('close')
        onClose() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers[0].type).toBe('close');
    });

    it('registers error handler', () => {
      class Ctrl {
        @OnSSE('error')
        onError() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers[0].type).toBe('error');
    });

    it('accumulates multiple handlers', () => {
      class Ctrl {
        @OnSSE('connection')
        onConnect() {}

        @OnSSE('close')
        onClose() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers).toHaveLength(2);
    });
  });

  describe('shortcut decorators', () => {
    it('@OnSSEConnection', () => {
      class Ctrl {
        @OnSSEConnection()
        onConnect() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers[0].type).toBe('connection');
    });

    it('@OnSSEClose', () => {
      class Ctrl {
        @OnSSEClose()
        onClose() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers[0].type).toBe('close');
    });

    it('@OnSSEError', () => {
      class Ctrl {
        @OnSSEError()
        onError() {}
      }
      const handlers = Reflect.getMetadata(SSE_METADATA_KEY, Ctrl);
      expect(handlers[0].type).toBe('error');
    });
  });

  describe('@InjectSSE', () => {
    it('creates sse parameter decorator', () => {
      class Ctrl {
        handler(@InjectSSE() sse: any) {}
      }
      const meta = Reflect.getMetadata('controller:route', Ctrl.prototype, 'handler');
      expect(meta.parameters).toHaveLength(1);
      expect(meta.parameters[0].type).toBe('sse');
    });
  });
});
