import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { GrpcClient, GrpcMethod, GrpcServer, GrpcService } from '@heliosjs/grpc';
import type { GrpcServiceClient } from '@heliosjs/grpc';

// Real end-to-end coverage for @heliosjs/grpc, over the actual wire — every
// other grpc test (__tests__/grpc/unit/*) mocks @grpc/grpc-js and
// @grpc/proto-loader entirely (vi.mock), so nothing else in this repo proves
// that a real proto, a real bound Server, and a real Client talking over a
// real socket actually work together: real proto loading, real
// serialize/deserialize, and (the part a mock can't prove at all) real gRPC
// error-status propagation from a thrown handler back to the client. Judgment
// call from .planning/phases/02-architecture-hardening/02-01-PLAN.md Task 7:
// writing this was a small delta (one small .proto fixture) for what it
// proves beyond the existing mocked unit suite, so it's written rather than
// leaving __tests__/grpc/e2e/ empty.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, 'fixtures/greet.proto');
const URL = '127.0.0.1:50999';

interface GreetRequest {
  name: string;
}
interface GreetReply {
  message: string;
}

@GrpcService('GreetService', { protoPath: PROTO_PATH, package: 'greet.v1' })
class GreetServiceImpl {
  @GrpcMethod()
  greet(req: GreetRequest): GreetReply {
    return { message: `hello ${req.name}` };
  }

  @GrpcMethod()
  fail(): GreetReply {
    throw new Error('boom');
  }
}

describe('gRPC e2e: real server + real client over the wire', () => {
  const server = new GrpcServer({ url: URL, log: false });
  server.registerService(GreetServiceImpl);
  const client = new GrpcClient({ protoPath: PROTO_PATH, package: 'greet.v1', url: URL });

  beforeAll(async () => {
    await server.start();
  });

  afterAll(async () => {
    client.close();
    await server.stop();
  });

  it('a real client call reaches the real handler and gets a real serialized response back', async () => {
    const service = client.getService<GrpcServiceClient>('GreetService');
    const reply = await firstValueFrom(service.greet({ name: 'world' }));
    expect(reply).toEqual({ message: 'hello world' });
  });

  it('propagates a thrown handler error as a real gRPC error status to the client', async () => {
    const service = client.getService<GrpcServiceClient>('GreetService');
    await expect(firstValueFrom(service.fail({ name: 'world' }))).rejects.toMatchObject({
      message: expect.stringContaining('boom'),
    });
  });
});
