---
description: GrpcModule — the singleton that groups a gRPC server and named gRPC clients.
---

# gRPC Module Documentation

## Introduction

The gRPC module provides decorator-driven gRPC servers and clients with RxJS Observable support.

## Overview

| Class | Description |
|-------|-------------|
| `GrpcModule` | Singleton module that groups a gRPC server and named clients |
| `GrpcServer` | Decorator-driven gRPC server |
| `GrpcClient` | gRPC client that returns RxJS Observables |

## Basic Setup

### Server

```typescript
import { GrpcModule, GrpcService, GrpcMethod } from "@heliosjs/grpc";
import { join } from "node:path";

@GrpcService("HeroService", {
  protoPath: join(__dirname, "./hero.proto"),
  package: "hero",
})
class HeroService {
  // No arguments: the method name ("findOne") already matches the proto
  // RPC ("FindOne") case-insensitively. A single string argument would
  // override the *service* name, not the method — see the Usage guide.
  @GrpcMethod()
  findOne(data: { id: number }) {
    return { id: data.id, name: "Hero " + data.id };
  }

  @GrpcMethod()
  findMany(data: { ids: number[] }) {
    return data.ids.map((id) => ({ id, name: "Hero " + id }));
  }
}

const grpc = GrpcModule.forRoot({
  server: {
    url: "0.0.0.0:50051",
    package: "hero",
    protoPath: join(__dirname, "./hero.proto"),
  },
});

const server = grpc.getServer();
server.registerService(HeroService);
await server.start();
```

### Client

```typescript
import { GrpcModule, GrpcClient } from "@heliosjs/grpc";
import { join } from "node:path";
import { firstValueFrom } from "rxjs";

const grpc = GrpcModule.forRoot({
  clients: [
    {
      name: "hero",
      options: {
        url: "localhost:50051",
        package: "hero",
        protoPath: join(__dirname, "./hero.proto"),
      },
    },
  ],
});

const client = grpc.getClient("hero");
const heroService = client.getService<{ findOne(data: { id: number }): any }>("HeroService");

const result = await firstValueFrom(heroService.findOne({ id: 1 }));
console.log(result); // { id: 1, name: "Hero 1" }
```

## Module Configuration

```typescript
const grpc = GrpcModule.forRoot({
  server: {
    url: "0.0.0.0:50051",
    package: "hero",
    protoPath: join(__dirname, "./hero.proto"),
  },
  clients: [
    {
      name: "hero",
      options: {
        url: "localhost:50051",
        package: "hero",
        protoPath: join(__dirname, "./hero.proto"),
      },
    },
    {
      name: "book",
      options: {
        url: "localhost:50052",
        package: "book",
        protoPath: join(__dirname, "./book.proto"),
      },
    },
  ],
});
```

## Decorators

| Decorator | Description |
|-----------|-------------|
| `@GrpcService(name, options?)` | Mark a class as a gRPC service |
| `@GrpcMethod(service?, method?)` | Mark a method as a unary RPC handler |
| `@GrpcStreamMethod(service?, method?)` | Mark a method as a streaming RPC handler |
| `@InjectGrpcClient(name)` | Inject a named `GrpcClient` |

## API Reference

Config types (`GrpcServerOptions`, `GrpcClientOptions`) and client-shape
types (`ClientGrpc`, `GrpcServiceClient`) are structural — you rarely name
them directly, `GrpcModule.forRoot()`/`new GrpcClient()`/`getService<T>()`
infer or accept them positionally, as shown throughout this page and
[Usage](./usage). The two exported error-handling utilities are worth a
look on their own, since neither has a real usage example anywhere else:

**`normalizeError(error)`** — what `GrpcServer` calls internally when a
handler throws, mapping the thrown value to a `{ code, message }` gRPC
status pair. An error with a numeric `.code` + `.message` (like `GrpcError`
below) passes through as-is; one with an HTTP-style `.statusCode` is
translated (`400`→`INVALID_ARGUMENT`, `401`→`UNAUTHENTICATED`,
`403`→`PERMISSION_DENIED`, `404`→`NOT_FOUND`, `409`→`ALREADY_EXISTS`,
`429`→`RESOURCE_EXHAUSTED`, `500`→`INTERNAL`, `501`→`UNIMPLEMENTED`,
`503`→`UNAVAILABLE`); anything else becomes `INTERNAL`. You won't usually
call this yourself — it's what makes a plain `throw new NotFoundError(...)`
(reusing a `@heliosjs/core` error class) still produce a sensible gRPC
status instead of an opaque `INTERNAL`.

**`toPromise(observable)`** — adapts an RxJS `Observable` (what
`GrpcClient`'s service methods return) to a `Promise` of its first emitted
value, tearing the subscription down afterward. A `Promise` passed in is
returned as-is, so it's safe to wrap either shape:

```typescript
import { toPromise } from "@heliosjs/grpc";

const user = await toPromise(heroService.findOne({ id: 1 }));
```

**`GrpcError`** / **`GrpcInvalidProtoError`** / **`GrpcServiceNotFoundError`**
— see [Error Handling](./examples#error-handling) for `GrpcError` in a
handler; the other two are thrown internally by `GrpcServer.registerService()`
(invalid proto file, service name not found in the loaded proto) — you
catch them, you don't construct them.

## Remarks

- `GrpcModule.forRoot()` is a singleton — subsequent calls return the same instance
- Services return RxJS Observables; use `firstValueFrom()` to get a Promise
- Proto files define the service contract
- The server auto-discovers methods from `@GrpcMethod` metadata
- Both `server.url` and each client's `options` default to plaintext — see
  [Credentials, TLS, and Auth](./usage#credentials-tls-and-auth) for turning
  TLS on and reading auth from call metadata (there's no `@Guard`/`@Roles`
  equivalent here)

## Related

- [gRPC Module Usage](./usage) — defining services/methods, credentials/TLS,
  metadata-based auth
- [gRPC Examples](./examples) — a fuller worked example, error handling, RxJS patterns
