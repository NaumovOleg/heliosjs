import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrpcServer } from '../../../src/grpc/src/server';
import { GRPC_SERVICE_METADATA, GRPC_METHOD_METADATA, GRPC_CLIENT_METADATA } from '../../../src/grpc/src/constants';
import { Observable } from 'rxjs';

vi.mock('@grpc/proto-loader', () => ({
  loadSync: vi.fn(() => ({ definition: true })),
}));

vi.mock('@grpc/grpc-js', () => {
  const mockBindAsync = vi.fn((_addr: any, _creds: any, cb: any) => cb(null, 50051));
  const mockTryShutdown = vi.fn((cb: any) => cb(null));
  const mockAddService = vi.fn();
  const MockServer = vi.fn().mockImplementation(() => ({
    bindAsync: mockBindAsync,
    tryShutdown: mockTryShutdown,
    addService: mockAddService,
  }));
  return {
    Server: MockServer,
    ServerCredentials: { createInsecure: vi.fn(() => 'insecure') },
    loadPackageDefinition: vi.fn(() => ({
      test: {
        Package: { service: { FindById: {}, FindAll: {} } },
      },
    })),
  };
});

function makeMeta(serviceName: string, methods: { name: string; handler: string; isStream?: boolean }[]) {
  return { serviceName, options: { protoPath: './test.proto', package: 'test' } };
}

function makeMethodMeta(methodName: string, handler: string, isStream = false) {
  return { methodName, handler, isStream };
}

describe('GrpcServer', () => {
  it('creates with default options', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    expect(server).toBeDefined();
  });

  it('creates with default url', () => {
    const server = new GrpcServer({});
    expect(server).toBeDefined();
  });

  it('creates with clients map', () => {
    const clients = new Map();
    const server = new GrpcServer({ url: '0.0.0.0:50051' }, clients);
    expect(server).toBeDefined();
  });

  it('registerService throws for undecorated class', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    class Undecorated {}
    expect(() => server.registerService(Undecorated)).toThrow('not decorated');
  });

  it('registerService throws when service not found in proto', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    class FakeService {}
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, {
      serviceName: 'NonExistent',
      options: { protoPath: './test.proto', package: 'test' },
    }, FakeService);
    expect(() => server.registerService(FakeService)).toThrow('not found');
  });

  it('registerService registers methods', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn();
    class TestService {
      myMethod = handler;
    }
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, {
      serviceName: 'Package',
      options: { protoPath: './test.proto', package: 'test' },
    }, TestService);
    Reflect.defineMetadata(GRPC_METHOD_METADATA, [
      makeMethodMeta('FindById', 'myMethod'),
    ], TestService);

    server.registerService(TestService);
  });

  it('registerService handles client injections', () => {
    const clients = new Map();
    const mockClient = { name: 'mock' };
    clients.set('myClient', mockClient as any);

    const server = new GrpcServer({ url: '0.0.0.0:50051' }, clients);
    class ServiceWithDeps {
      constructor(public client: any) {}
    }
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, {
      serviceName: 'Package',
      options: { protoPath: './test.proto', package: 'test' },
    }, ServiceWithDeps);
    Reflect.defineMetadata(GRPC_METHOD_METADATA, [], ServiceWithDeps);
    Reflect.defineMetadata(GRPC_CLIENT_METADATA, [
      { index: 0, name: 'myClient' },
    ], ServiceWithDeps);

    server.registerService(ServiceWithDeps);
  });

  it('registerService throws when injected client not found', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    class ServiceWithMissingDep {
      constructor(public client: any) {}
    }
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, {
      serviceName: 'Package',
      options: { protoPath: './test.proto', package: 'test' },
    }, ServiceWithMissingDep);
    Reflect.defineMetadata(GRPC_METHOD_METADATA, [], ServiceWithMissingDep);
    Reflect.defineMetadata(GRPC_CLIENT_METADATA, [
      { index: 0, name: 'nonexistent' },
    ], ServiceWithMissingDep);

    expect(() => server.registerService(ServiceWithMissingDep)).toThrow('not found for injection');
  });

  it('start binds and resolves', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    await server.start();
  });

  it('stop shuts down gracefully', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    await server.stop();
  });

  it('executeHandler calls callback with result', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockReturnValue({ id: '1' });
    const callback = vi.fn();
    const methodMeta = makeMethodMeta('FindById', 'handler');

    await (server as any).executeHandler(handler, methodMeta, { request: { id: '1' }, metadata: {} }, callback);
    expect(callback).toHaveBeenCalledWith(null, { id: '1' });
  });

  it('executeHandler handles Promise results', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockResolvedValue({ id: '2' });
    const callback = vi.fn();
    const methodMeta = makeMethodMeta('FindById', 'handler');

    await (server as any).executeHandler(handler, methodMeta, { request: { id: '2' }, metadata: {} }, callback);
    expect(callback).toHaveBeenCalledWith(null, { id: '2' });
  });

  it('executeHandler handles Observable results', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockReturnValue(new Observable((sub) => {
      sub.next({ id: '3' });
      sub.complete();
    }));
    const callback = vi.fn();
    const methodMeta = makeMethodMeta('FindById', 'handler');

    await (server as any).executeHandler(handler, methodMeta, { request: { id: '3' }, metadata: {} }, callback);
    expect(callback).toHaveBeenCalledWith(null, { id: '3' });
  });

  it('executeHandler handles stream Observable', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockReturnValue(new Observable((sub) => {
      sub.next({ id: '4' });
      sub.complete();
    }));
    const call = { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), request: { id: '4' }, metadata: {} };
    const methodMeta = makeMethodMeta('FindById', 'handler', true);

    await (server as any).executeHandler(handler, methodMeta, call, vi.fn());
    expect(call.write).toHaveBeenCalledWith({ id: '4' });
    expect(call.end).toHaveBeenCalled();
  });

  it('executeHandler handles stream Observable error', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockReturnValue(new Observable((sub) => {
      sub.error(new Error('stream err'));
    }));
    const call = { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), request: {}, metadata: {} };
    const methodMeta = makeMethodMeta('FindById', 'handler', true);

    await (server as any).executeHandler(handler, methodMeta, call, vi.fn());
    expect(call.destroy).toHaveBeenCalled();
  });

  it('executeHandler handles thrown errors', async () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    const handler = vi.fn().mockImplementation(() => { throw new Error('handler err'); });
    const callback = vi.fn();
    const methodMeta = makeMethodMeta('FindById', 'handler');

    await (server as any).executeHandler(handler, methodMeta, { request: {}, metadata: {} }, callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Number), message: 'handler err' }));
  });

  it('normalizeMethodName lowercases first char', () => {
    const server = new GrpcServer({ url: '0.0.0.0:50051' });
    expect((server as any).normalizeMethodName('FindById')).toBe('findById');
    expect((server as any).normalizeMethodName('Get')).toBe('get');
  });
});
