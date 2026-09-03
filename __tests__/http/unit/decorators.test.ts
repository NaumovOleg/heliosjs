import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Server, Port, Host } from '@heliosjs/http';

// SERVER_CONFIG_KEY is used internally by the decorators
// We verify it works by checking the metadata is stored
const SERVER_CONFIG_KEY = 'server:config';

describe('@Server', () => {
  it('sets server config metadata', () => {
    @Server({ port: 3000 })
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.port).toBe(3000);
  });

  it('merges with existing config', () => {
    @Server({ port: 3000 })
    @Server({ host: 'localhost' })
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('localhost');
  });

  it('merges controllers arrays', () => {
    class Ctrl1 {}
    class Ctrl2 {}
    @Server({ controllers: [Ctrl1] })
    @Server({ controllers: [Ctrl2] })
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    // TC39 decorators execute bottom-to-top, so Ctrl2 is processed first
    expect(config.controllers).toEqual([Ctrl2, Ctrl1]);
  });

  it('merges middlewares arrays', () => {
    const mw1 = () => {};
    const mw2 = () => {};
    @Server({ middlewares: [mw1] })
    @Server({ middlewares: [mw2] })
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    // TC39 decorators execute bottom-to-top, so mw2 is processed first
    expect(config.middlewares).toEqual([mw2, mw1]);
  });

  it('sets cors config', () => {
    @Server({ cors: { origin: 'http://example.com' } })
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.cors.origin).toBe('http://example.com');
  });

  it('handles empty config', () => {
    @Server()
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config).toBeDefined();
  });
});

describe('@Port', () => {
  it('sets port metadata', () => {
    @Port(8080)
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.port).toBe(8080);
  });

  it('merges with existing config', () => {
    @Server({ host: 'localhost' })
    @Port(9090)
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.port).toBe(9090);
    expect(config.host).toBe('localhost');
  });
});

describe('@Host', () => {
  it('sets host metadata', () => {
    @Host('0.0.0.0')
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.host).toBe('0.0.0.0');
  });

  it('merges with existing config', () => {
    @Port(3000)
    @Host('127.0.0.1')
    class TestServer {}
    const config = Reflect.getMetadata(SERVER_CONFIG_KEY, TestServer);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
  });
});
