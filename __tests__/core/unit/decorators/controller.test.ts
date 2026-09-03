import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '@heliosjs/core';
import {
  CONTROLLER_META,
  CONTROLLER_PRECOMPILED,
  CONTROLLER_LOOKUP_WS,
  CONTROLLER_LOOKUP_SSE,
} from '@heliosjs/core/constants';

describe('@Controller decorator', () => {
  it('sets route prefix metadata with string path', () => {
    @Controller('/users')
    class UserController {}
    const meta = Reflect.getMetadata('controller:config', UserController.prototype);
    expect(meta).toBeDefined();
    expect(meta.prefix).toBe('/users');
  });

  it('defaults prefix to / when no path given', () => {
    @Controller('/')
    class RootController {}
    const meta = Reflect.getMetadata('controller:config', RootController.prototype);
    expect(meta.prefix).toBe('/');
  });

  it('sets prefix from config object', () => {
    @Controller({ prefix: '/api/v1' })
    class ApiController {}
    const meta = Reflect.getMetadata('controller:config', ApiController.prototype);
    expect(meta.prefix).toBe('/api/v1');
  });

  it('sets controllers from config object', () => {
    class SubCtrl {}
    @Controller({ prefix: '/api', controllers: [SubCtrl] })
    class ParentController {}
    const meta = Reflect.getMetadata('controller:config', ParentController.prototype);
    expect(meta.controllers).toContain(SubCtrl);
  });

  it('sets middlewares from config object via defineMiddlewaresMeta', () => {
    const mw = () => {};
    @Controller({ prefix: '/api', middlewares: [mw as any] })
    class ApiController {}
    const mwMeta = Reflect.getMetadata('controller:middlewares', ApiController);
    expect(mwMeta).toBeDefined();
    expect(mwMeta.length).toBeGreaterThan(0);
  });

  it('sets middlewares via second argument', () => {
    const mw = () => {};
    @Controller('/api', [mw as any])
    class ApiController {}
    const mwMeta = Reflect.getMetadata('controller:middlewares', ApiController);
    expect(mwMeta).toBeDefined();
    expect(mwMeta.length).toBeGreaterThan(0);
  });

  it('throws TypeError for non-string prefix', () => {
    expect(() => {
      @Controller({ prefix: 123 as any })
      class BadController {}
    }).toThrow(TypeError);
  });

  it('throws TypeError for non-function sub-controllers', () => {
    expect(() => {
      @Controller({ prefix: '/api', controllers: ['not-a-function' as any] })
      class BadController {}
    }).toThrow(TypeError);
  });

  it('wraps class prototype with descriptors', () => {
    @Controller('/test')
    class TestCtrl {}
    // The wrapped class should have the descriptors defined
    const proto = TestCtrl.prototype;
    expect(proto[CONTROLLER_META]).toBeDefined();
    expect(typeof proto[CONTROLLER_META]).toBe('function');
  });

  it('sets CONTROLLER_PRECOMPILED when instantiated with parent', () => {
    const parentMeta = { prefix: '/parent', name: 'Parent', functions: [], routes: [] };

    @Controller('/test')
    class TestCtrl {
      [CONTROLLER_LOOKUP_WS]() {}
      [CONTROLLER_LOOKUP_SSE]() {}
    }

    const instance = new TestCtrl(parentMeta);
    expect(instance[CONTROLLER_PRECOMPILED]).toBeDefined();
    expect(instance[CONTROLLER_PRECOMPILED].prefix).toContain('/test');
  });

  it('preserves own methods on the prototype', () => {
    @Controller('/test')
    class TestCtrl {
      [CONTROLLER_LOOKUP_WS]() {}
      [CONTROLLER_LOOKUP_SSE]() {}
      myMethod() {
        return 42;
      }
    }

    const instance = new TestCtrl({ prefix: '/', name: 'root', functions: [], routes: [] });
    expect((instance as any).myMethod()).toBe(42);
  });
});
