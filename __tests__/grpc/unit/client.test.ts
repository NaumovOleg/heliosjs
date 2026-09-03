import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrpcClient } from '../../../src/grpc/src/client';

const mockClientInstance = {
  FindById: vi.fn(),
  FindAll: vi.fn(),
  close: vi.fn(),
};

function MockGrpcClient(this: any) {
  Object.assign(this, mockClientInstance);
}
(MockGrpcClient as any).prototype = mockClientInstance;

vi.mock('@grpc/grpc-js', () => ({
  loadPackageDefinition: vi.fn(() => ({
    test: { Package: MockGrpcClient as any },
  })),
  credentials: {
    createInsecure: vi.fn(() => 'insecure-creds'),
  },
}));

vi.mock('@grpc/proto-loader', () => ({
  loadSync: vi.fn(() => ({ definition: true })),
}));

describe('GrpcClient', () => {
  it('creates client with default url', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    expect(client).toBeDefined();
  });

  it('creates client with custom url', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test', url: 'localhost:50051' });
    expect(client).toBeDefined();
  });

  it('throws when neither protoPath nor packageDefinition', () => {
    expect(() => new GrpcClient({ package: 'test' } as any)).toThrow();
  });

  it('uses provided packageDefinition', () => {
    const pd = {} as any;
    const client = new GrpcClient({ packageDefinition: pd, package: 'test' } as any);
    expect(client).toBeDefined();
  });

  it('getService throws when package not found', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'nonexistent.pkg' });
    expect(() => client.getService('Service')).toThrow('not found');
  });

  it('getService returns wrapped service methods as observables', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    const service = client.getService<any>('Package');
    expect(service).toBeDefined();
    expect(typeof service).toBe('object');
    expect(typeof service.FindById).toBe('function');
    expect(typeof service.FindAll).toBe('function');
  });

  it('service methods return observables', async () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    const service = client.getService<any>('Package');
    mockClientInstance.FindById.mockImplementation((args: any, callback: any) => {
      callback(null, { id: '42' });
    });
    const result = await service.FindById({ id: '42' }).toPromise();
    expect(result).toEqual({ id: '42' });
  });

  it('service methods handle errors', async () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    const service = client.getService<any>('Package');
    mockClientInstance.FindById.mockImplementation((args: any, callback: any) => {
      callback(new Error('not found'), null);
    });
    await expect(service.FindById({ id: '42' }).toPromise()).rejects.toThrow('not found');
  });

  it('caches service clients', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    const s1 = client.getService<any>('Package');
    const s2 = client.getService<any>('Package');
    expect(s1).toBe(s2);
  });

  it('close clears service clients', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    client.getService<any>('Package');
    client.close();
  });

  it('close handles empty clients map', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    client.close();
  });

  it('throws when service not found in package', () => {
    const client = new GrpcClient({ protoPath: './test.proto', package: 'test' });
    expect(() => client.getService('NonExistent')).toThrow('not found');
  });
});
