import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../../src/http/src/utils/http/server';
import { SERVER_CONFIG_KEY, CATCH, INTERCEPT, USE_MIDDLEWARE, SANITIZE } from '@heliosjs/core/constants';

describe('resolveConfig', () => {
  it('throws when called with undefined', () => {
    expect(() => resolveConfig(undefined)).toThrow('Invalid root controller');
  });

  it('throws when called with non-function', () => {
    expect(() => resolveConfig('not-a-class')).toThrow('Invalid root controller');
  });

  it('resolves defaults from class without decorators', () => {
    class App {}
    const config = resolveConfig(App);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('localhost');
    expect(config.controllers).toEqual([]);
    expect(config.middlewares).toEqual([]);
    expect(config.interceptors).toEqual([]);
  });

  it('resolves decorator-configured port and host', () => {
    class App {}
    Reflect.defineMetadata(SERVER_CONFIG_KEY, { port: 8080, host: '0.0.0.0' }, App);
    const config = resolveConfig(App);
    expect(config.port).toBe(8080);
    expect(config.host).toBe('0.0.0.0');
  });

  it('resolves errorHandler from CATCH metadata', () => {
    const handler = () => {};
    class App {}
    Reflect.defineMetadata(CATCH, handler, App);
    const config = resolveConfig(App);
    expect(config.errorHandler).toBe(handler);
  });

  it('resolves interceptors from INTERCEPT metadata', () => {
    const interceptor = () => {};
    class App {}
    Reflect.defineMetadata(INTERCEPT, interceptor, App);
    const config = resolveConfig(App);
    expect(config.interceptors).toContain(interceptor);
  });

  it('resolves middlewares from USE_MIDDLEWARE metadata', () => {
    const mw = () => {};
    class App {}
    Reflect.defineMetadata(USE_MIDDLEWARE, [mw], App);
    const config = resolveConfig(App);
    expect(config.middlewares).toContain(mw);
  });

  it('resolves sanitizers from SANITIZE metadata', () => {
    const sanitizer = { type: 'string' as const };
    class App {}
    Reflect.defineMetadata(SANITIZE, [sanitizer], App.prototype);
    const config = resolveConfig(App);
    expect(config.sanitizers).toContain(sanitizer);
  });

  it('merges decorator config with defaults', () => {
    class App {}
    Reflect.defineMetadata(SERVER_CONFIG_KEY, {
      port: 4000,
      cors: { origin: '*' },
      controllers: [],
    }, App);
    const config = resolveConfig(App);
    expect(config.port).toBe(4000);
    expect(config.cors).toEqual({ origin: '*' });
  });

  it('defaults websocketPath to /ws', () => {
    class App {}
    const config = resolveConfig(App);
    expect((config as any).websocketPath).toBe('/ws');
  });

  it('uses decoratorConfig.websocketPath when provided', () => {
    class App {}
    Reflect.defineMetadata(SERVER_CONFIG_KEY, { websocketPath: '/custom-ws' }, App);
    const config = resolveConfig(App);
    expect((config as any).websocketPath).toBe('/custom-ws');
  });

  it('prefers decoratorConfig.errorHandler over CATCH metadata', () => {
    const decoratorHandler = () => {};
    const catchHandler = () => {};
    class App {}
    Reflect.defineMetadata(SERVER_CONFIG_KEY, { errorHandler: decoratorHandler }, App);
    Reflect.defineMetadata(CATCH, catchHandler, App);
    const config = resolveConfig(App);
    expect(config.errorHandler).toBe(decoratorHandler);
  });

  it('filters null/undefined from controllers', () => {
    class App {}
    Reflect.defineMetadata(SERVER_CONFIG_KEY, { controllers: [null, undefined, class {}] }, App);
    const config = resolveConfig(App);
    expect(config.controllers).toHaveLength(1);
  });
});
