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

```typescript
import { join } from "node:path";
import { GrpcService, GrpcMethod, InjectGrpcClient, GrpcClient } from "@heliosjs/grpc";

@GrpcService("HeroService", {
  protoPath: join(__dirname, "./hero.proto"),
  package: "hero",
})
export class HeroService {
  constructor(@InjectGrpcClient("HeroService") private client: any) {}

  @GrpcMethod("FindOne")
  findOne(data: { id: number }) {
    return { id: data.id, name: "Hero " + data.id };
  }

  @GrpcMethod("FindMany")
  *findMany(data: { ids: number[] }) {
    for (const id of data.ids) {
      yield { id, name: "Hero " + id };
    }
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
import { firstValueFrom } from "rxjs";
import { client } from "./client";
import { HeroService } from "./server";

const grpc = GrpcModule.forRoot({
  server: {
    url: "0.0.0.0:50051",
    package: "hero",
    protoPath: join(__dirname, "./hero.proto"),
  },
  clients: [
    {
      name: "Book",
      options: {
        url: "localhost:50052",
        package: "book",
        protoPath: join(__dirname, "./book.proto"),
      },
    },
  ],
});

const server = grpc.getServer();
if (server) {
  server.registerService(HeroService);
  server.start();
}

// Client call
async function callGrpc() {
  const heroService = client.getService<{
    getOne(request: any): any;
  }>("HeroService");

  const response = await firstValueFrom(heroService.getOne({ name: "John" }));
  console.log(response);
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

// Register multiple services
server.registerService(HeroService);
server.registerService(BookService);
server.registerService(ReviewService);
```

## Error Handling

```typescript
import { GrpcError, GrpcServiceNotFoundError } from "@heliosjs/grpc";

@GrpcService("UserService", { ... })
export class UserService {
  @GrpcMethod("FindOne")
  findOne(data: { id: number }) {
    const user = findUser(data.id);
    if (!user) {
      throw new GrpcServiceNotFoundError(`User ${data.id} not found`);
    }
    return user;
  }

  @GrpcMethod("Create")
  create(data: { name: string }) {
    if (!data.name) {
      throw new GrpcError(3, "INVALID_ARGUMENT: name is required");
    }
    return { id: Date.now(), name: data.name };
  }
}
```

## RxJS Integration

```typescript
import { Observable, of, delay, map } from "rxjs";

@GrpcService("UserService", { ... })
export class UserService {
  @GrpcMethod("FindOne")
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
3. The client makes a call to `getOne`
4. Observe the console output
