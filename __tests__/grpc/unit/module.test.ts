import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import { GrpcModule } from '../../../src/grpc/src/module';

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
});
