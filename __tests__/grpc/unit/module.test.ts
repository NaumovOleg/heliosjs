import 'reflect-metadata';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrpcModule } from '../../../src/grpc/src/module';

vi.mock('@grpc/grpc-js', () => ({
  loadPackageDefinition: vi.fn(() => ({ test: { Package: vi.fn() } })),
  credentials: { createInsecure: vi.fn(() => 'insecure-creds') },
  Server: vi.fn().mockImplementation(function (this: any) {
    this.bindAsync = vi.fn((_addr: any, _creds: any, cb: any) => cb(null, 50051));
    this.tryShutdown = vi.fn((cb: any) => cb(null));
    this.addService = vi.fn();
  }),
  ServerCredentials: { createInsecure: vi.fn(() => 'insecure') },
}));

vi.mock('@grpc/proto-loader', () => ({
  loadSync: vi.fn(() => ({ definition: true })),
}));

beforeEach(() => {
  (GrpcModule as any).instance = undefined;
});

describe('GrpcModule', () => {
  it('creates singleton instance', () => {
    const mod = GrpcModule.forRoot({});
    const mod2 = GrpcModule.forRoot({});
    expect(mod).toBe(mod2);
  });

  it('returns null server when not configured', () => {
    const mod = GrpcModule.forRoot({});
    expect(mod.getServer()).toBeNull();
  });

  it('returns null client when name not found', () => {
    const mod = GrpcModule.forRoot({});
    expect(mod.getClient('nonexistent')).toBeNull();
  });

  it('getServer returns null when no server config', () => {
    const mod = GrpcModule.forRoot({});
    expect(mod.getServer()).toBeNull();
  });

  it('getClient returns null for empty clients', () => {
    const mod = GrpcModule.forRoot({ clients: [] });
    expect(mod.getClient('test')).toBeNull();
  });

  it('forRoot always returns same instance', () => {
    const a = GrpcModule.forRoot({});
    const b = GrpcModule.forRoot({});
    const c = GrpcModule.forRoot({});
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('registers a named client reachable via getClient', () => {
    const mod = GrpcModule.forRoot({
      clients: [{ name: 'users', options: { protoPath: './test.proto', package: 'test' } }],
    });
    expect(mod.getClient('users')).toBeDefined();
    expect(mod.getClient('users')).not.toBeNull();
  });

  it('creates a server when server config is provided', () => {
    const mod = GrpcModule.forRoot({ server: { url: '0.0.0.0:50051' } });
    expect(mod.getServer()).not.toBeNull();
  });

  it('start() is a no-op when no server is configured', async () => {
    const mod = GrpcModule.forRoot({});
    await expect(mod.start()).resolves.toBeUndefined();
  });

  it('stop() is a no-op when no server is configured', async () => {
    const mod = GrpcModule.forRoot({});
    await expect(mod.stop()).resolves.toBeUndefined();
  });

  it('start() delegates to the configured server', async () => {
    const mod = GrpcModule.forRoot({ server: { url: '0.0.0.0:50051' } });
    const start = vi.fn().mockResolvedValue(undefined);
    (mod as any).server = { start, stop: vi.fn() };
    await mod.start();
    expect(start).toHaveBeenCalledOnce();
  });

  it('stop() delegates to the configured server', async () => {
    const mod = GrpcModule.forRoot({ server: { url: '0.0.0.0:50051' } });
    const stop = vi.fn().mockResolvedValue(undefined);
    (mod as any).server = { start: vi.fn(), stop };
    await mod.stop();
    expect(stop).toHaveBeenCalledOnce();
  });
});
