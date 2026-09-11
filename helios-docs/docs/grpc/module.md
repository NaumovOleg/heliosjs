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

## Remarks

- `GrpcModule.forRoot()` is a singleton — subsequent calls return the same instance
- Services return RxJS Observables; use `firstValueFrom()` to get a Promise
- Proto files define the service contract
- The server auto-discovers methods from `@GrpcMethod` metadata
