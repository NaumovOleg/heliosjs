---
description: A full client-server gRPC example, plus multi-service, error-handling, and RxJS patterns.
---

# gRPC Module Examples

## Full Client-Server Example

### Proto File (`hero.proto`)

```protobuf
syntax = "proto3";
package hero;

service HeroService {
  rpc FindOne (HeroRequest) returns (HeroResponse);
  rpc FindMany (HeroManyRequest) returns (stream HeroResponse);
}

message HeroRequest {
  int32 id = 1;
}

message HeroManyRequest {
  repeated int32 ids = 1;
}

message HeroResponse {
  int32 id = 1;
  string name = 2;
}
```

### Server (`server.ts`)

`FindMany` is declared `returns (stream HeroResponse)` in the proto, so its
handler is a `@GrpcStreamMethod` that writes to the call directly — not a
generator function, and not a plain `@GrpcMethod`:

```typescript
import { join } from "node:path";
import type { ServerWritableStream } from "@grpc/grpc-js";
import { GrpcService, GrpcMethod, GrpcStreamMethod } from "@heliosjs/grpc";

@GrpcService("HeroService", {
  protoPath: join(__dirname, "./hero.proto"),
  package: "hero",
})
export class HeroService {
  @GrpcMethod()
  findOne(data: { id: number }) {
    return { id: data.id, name: "Hero " + data.id };
  }

  @GrpcStreamMethod()
  findMany(call: ServerWritableStream<{ ids: number[] }, { id: number; name: string }>) {
    for (const id of call.request.ids) {
      call.write({ id, name: "Hero " + id });
    }
    call.end();
  }
}
```

### Client (`client.ts`)

```typescript
import { join } from "node:path";
import { GrpcClient } from "@heliosjs/grpc";

export const client = new GrpcClient({
  url: "localhost:50051",
  package: "hero",
  protoPath: join(__dirname, "./hero.proto"),
});
```

### Entry Point (`index.ts`)

```typescript
import { join } from "node:path";
import { GrpcModule } from "@heliosjs/grpc";
import { firstValueFrom, type Observable } from "rxjs";
import { client } from "./client";
import { HeroService } from "./server";

const grpc = GrpcModule.forRoot({
  server: {
    url: "0.0.0.0:50051",
    package: "hero",
    protoPath: join(__dirname, "./hero.proto"),
  },
});

const server = grpc.getServer();
if (server) {
  server.registerService(HeroService);
  await server.start();
}

// Client call
async function callGrpc() {
  const heroService = client.getService<{
    findOne(request: { id: number }): Observable<{ id: number; name: string }>;
  }>("HeroService");

  const response = await firstValueFrom(heroService.findOne({ id: 1 }));
  console.log(response); // { id: 1, name: "Hero 1" }
}

callGrpc().catch(console.error);
```

## Multiple Services

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

// Register multiple services against the one server
const server = grpc.getServer()!;
server.registerService(HeroService);
server.registerService(BookService);
server.registerService(ReviewService);
await server.start();
```

## Error Handling

```typescript
import { GrpcService, GrpcMethod, GrpcError } from "@heliosjs/grpc";
import { join } from "node:path";

@GrpcService("UserService", {
  protoPath: join(__dirname, "./user.proto"),
  package: "user",
})
export class UserService {
  @GrpcMethod()
  findOne(data: { id: number }) {
    const user = findUser(data.id);
    if (!user) {
      // 5 = NOT_FOUND — see @grpc/grpc-js `status` for the full code list.
      throw new GrpcError(5, `User ${data.id} not found`);
    }
    return user;
  }

  @GrpcMethod()
  create(data: { name: string }) {
    if (!data.name) {
      // 3 = INVALID_ARGUMENT
      throw new GrpcError(3, "name is required");
    }
    return { id: Date.now(), name: data.name };
  }
}
```

## RxJS Integration

```typescript
import { GrpcService, GrpcMethod } from "@heliosjs/grpc";
import { Observable, of, delay, map } from "rxjs";
import { join } from "node:path";

@GrpcService("UserService", {
  protoPath: join(__dirname, "./user.proto"),
  package: "user",
})
export class UserService {
  @GrpcMethod()
  findOne(data: { id: number }): Observable<{ id: number; name: string }> {
    return of({ id: data.id, name: "User " + data.id }).pipe(
      delay(100), // Simulate async
      map((user) => ({ ...user, fetchedAt: Date.now() })),
    );
  }
}
```

## How to Run

1. Place `hero.proto` in the same directory as the examples
2. Start the gRPC server
3. The client makes a call to `findOne`
4. Observe the console output
