import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GrpcService, GrpcMethod, GrpcStreamMethod, InjectGrpcClient } from '@heliosjs/grpc';
import { GRPC_SERVICE_METADATA, GRPC_METHOD_METADATA, GRPC_CLIENT_METADATA } from '../../../src/grpc/src/constants';

describe('@GrpcService', () => {
  it('sets service metadata on class', () => {
    @GrpcService('UserService')
    class UserGrpc {}
    const meta = Reflect.getMetadata(GRPC_SERVICE_METADATA, UserGrpc);
    expect(meta.serviceName).toBe('UserService');
  });

  it('stores options', () => {
    const opts = { protoPath: './proto/user.proto', package: 'user' };
    @GrpcService('UserService', opts)
    class UserGrpc {}
    const meta = Reflect.getMetadata(GRPC_SERVICE_METADATA, UserGrpc);
    expect(meta.options).toEqual(opts);
  });
});

describe('@GrpcMethod', () => {
  it('registers method metadata', () => {
    @GrpcService('UserService')
    class UserGrpc {
      @GrpcMethod()
      getUser() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, UserGrpc);
    expect(meta.length).toBe(1);
    expect(meta[0].handler).toBe('getUser');
    expect(meta[0].isStream).toBe(false);
  });

  it('overrides method name', () => {
    @GrpcService('UserService')
    class UserGrpc {
      @GrpcMethod('UserService', 'GetUser')
      findUser() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, UserGrpc);
    expect(meta[0].methodName).toBe('GetUser');
    expect(meta[0].serviceName).toBe('UserService');
  });

  it('uses property key as methodName by default', () => {
    @GrpcService('UserService')
    class UserGrpc {
      @GrpcMethod()
      listUsers() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, UserGrpc);
    expect(meta[0].methodName).toBe('listUsers');
  });

  it('accumulates multiple methods', () => {
    @GrpcService('UserService')
    class UserGrpc {
      @GrpcMethod()
      getUser() {}

      @GrpcMethod()
      createUser() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, UserGrpc);
    expect(meta.length).toBe(2);
  });
});

describe('@GrpcStreamMethod', () => {
  it('registers streaming method', () => {
    @GrpcService('ChatService')
    class ChatGrpc {
      @GrpcStreamMethod()
      sendMessage() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, ChatGrpc);
    expect(meta[0].isStream).toBe(true);
    expect(meta[0].handler).toBe('sendMessage');
  });

  it('overrides names', () => {
    @GrpcService('ChatService')
    class ChatGrpc {
      @GrpcStreamMethod('ChatService', 'SendMessage')
      send() {}
    }
    const meta = Reflect.getMetadata(GRPC_METHOD_METADATA, ChatGrpc);
    expect(meta[0].methodName).toBe('SendMessage');
    expect(meta[0].serviceName).toBe('ChatService');
  });
});

describe('@InjectGrpcClient', () => {
  it('registers injection metadata', () => {
    class Controller {
      constructor(
        @InjectGrpcClient('user-service') private readonly userClient: any
      ) {}
    }
    const injections = Reflect.getMetadata(GRPC_CLIENT_METADATA, Controller);
    expect(injections.length).toBe(1);
    expect(injections[0].name).toBe('user-service');
    expect(injections[0].index).toBe(0);
  });

  it('accumulates multiple injections', () => {
    class Controller {
      constructor(
        @InjectGrpcClient('user-service') private readonly userClient: any,
        @InjectGrpcClient('order-service') private readonly orderClient: any
      ) {}
    }
    const injections = Reflect.getMetadata(GRPC_CLIENT_METADATA, Controller);
    expect(injections.length).toBe(2);
    // Parameter decorators execute right-to-left, so order is reversed
    expect(injections[0].name).toBe('order-service');
    expect(injections[1].name).toBe('user-service');
  });
});
