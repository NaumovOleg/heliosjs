# gRPC Module Usage

## Defining gRPC Services

Use `@GrpcService` to mark a class as a gRPC service:

```typescript
import { GrpcService, GrpcMethod } from "@heliosjs/grpc";
import { join } from "node:path";

@GrpcService("UserService", {
  protoPath: join(__dirname, "./user.proto"),
  package: "user",
})
export class UserService {
  @GrpcMethod("FindOne")
  findOne(data: { id: number }) {
    return { id: data.id, name: "User " + data.id };
  }

  @GrpcMethod("FindMany")
  findMany(data: { ids: number[] }) {
    return data.ids.map((id) => ({ id, name: "User " + id }));
  }

  @GrpcMethod("Create")
  create(data: { name: string; email: string }) {
    return { id: Date.now(), ...data };
  }
}
```

## Implementing gRPC Methods

`@GrpcMethod` takes optional service name and method name:

```typescript
// Auto-detected from class name
@GrpcMethod("FindOne")
findOne(data: { id: number }) { return { id: data.id }; }

// Explicit service and method names
@GrpcMethod("UserService", "FindOne")
findOne(data: { id: number }) { return { id: data.id }; }
```

## Streaming Methods

Use `@GrpcStreamMethod` for streaming RPCs:

```typescript
import { GrpcService, GrpcStreamMethod } from "@heliosjs/grpc";

@GrpcService("ChatService", {
  protoPath: join(__dirname, "./chat.proto"),
  package: "chat",
})
export class ChatService {
  @GrpcStreamMethod("Chat")
  chat(call: any) {
    call.on("data", (message: any) => {
      console.log("Received:", message);
      call.write({ text: "Echo: " + message.text });
    });

    call.on("end", () => {
      call.end();
    });
  }
}
```

## Injecting gRPC Clients

Use `@InjectGrpcClient` to inject a named client:

```typescript
import { InjectGrpcClient, GrpcClient } from "@heliosjs/grpc";

export class UserOrchestrator {
  constructor(
    @InjectGrpcClient("hero") private heroClient: GrpcClient,
    @InjectGrpcClient("book") private bookClient: GrpcClient,
  ) {}

  async getUserWithBooks(userId: number) {
    const heroService = this.heroClient.getService<{ findOne(data: any): any }>("HeroService");
    const bookService = this.bookClient.getService<{ findByUser(data: any): any }>("BookService");

    const [user, books] = await Promise.all([
      firstValueFrom(heroService.findOne({ id: userId })),
      firstValueFrom(bookService.findByUser({ userId })),
    ]);

    return { ...user, books };
    }
}
```

## Client Usage

```typescript
import { GrpcClient } from "@heliosjs/grpc";
import { join } from "node:path";
import { firstValueFrom } from "rxjs";

const client = new GrpcClient({
  url: "localhost:50051",
  package: "hero",
  protoPath: join(__dirname, "./hero.proto"),
});

const heroService = client.getService<{
  findOne(data: { id: number }): Observable<{ id: number; name: string }>;
  findMany(data: { ids: number[] }): Observable<{ id: number; name: string }[]>;
}>("HeroService");

// Observable-based
heroService.findOne({ id: 1 }).subscribe((result) => {
  console.log(result);
});

// Promise-based
const result = await firstValueFrom(heroService.findOne({ id: 1 }));
console.log(result);

// Clean up
client.close();
```

## Server Lifecycle

```typescript
import { GrpcModule } from "@heliosjs/grpc";

const grpc = GrpcModule.forRoot({ server: { url: "0.0.0.0:50051", ... } });

// Start
await grpc.start();

// Get instances
const server = grpc.getServer();
const client = grpc.getClient("hero");

// Stop
await grpc.stop();
```

## Remarks

- `@GrpcService` stores metadata via reflect-metadata
- `@GrpcMethod` auto-discovers the service name from the class decorator
- `@InjectGrpcClient` requires the client to be registered in `GrpcModule.forRoot()`
- Client methods return RxJS Observables
- Use `toPromise()` from `@heliosjs/grpc` to convert Observables to Promises
