---
description: Define gRPC services, unary and streaming methods, and clients with HeliosJS's gRPC decorators.
---

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
  // No arguments needed — the method name ("findOne") already matches the
  // proto RPC ("FindOne") case-insensitively.
  @GrpcMethod()
  findOne(data: { id: number }) {
    return { id: data.id, name: "User " + data.id };
  }

  @GrpcMethod()
  findMany(data: { ids: number[] }) {
    return data.ids.map((id) => ({ id, name: "User " + id }));
  }

  @GrpcMethod()
  create(data: { name: string; email: string }) {
    return { id: Date.now(), ...data };
  }
}
```

## Implementing gRPC Methods

`@GrpcMethod(serviceName?, methodName?)` — **both arguments are positional
overrides, in that order**. It's easy to misread the first argument as "the
method name"; it is not.

```typescript
// Most common case: no arguments. The method name is taken from the
// property itself ("findOne"), matched against the proto RPC ("FindOne").
@GrpcMethod()
findOne(data: { id: number }) { return { id: data.id }; }

// Override the method name only — pass undefined for serviceName so it
// still falls back to the enclosing @GrpcService.
@GrpcMethod(undefined, "FindOne")
lookupOne(data: { id: number }) { return { id: data.id }; }

// Override both service and method name.
@GrpcMethod("UserService", "FindOne")
findOne(data: { id: number }) { return { id: data.id }; }
```

:::warning
`@GrpcMethod("FindOne")` with a **single** argument does **not** set the
method name — it overrides the *service* name to `"FindOne"`. With no proto
service actually called that, registration fails with `Service "FindOne" not
found`. If the property name already matches the RPC name (the common case),
skip the arguments entirely: `@GrpcMethod()`.
:::

## Streaming Methods

Use `@GrpcStreamMethod` for streaming RPCs:

```typescript
import { GrpcService, GrpcStreamMethod } from "@heliosjs/grpc";

@GrpcService("ChatService", {
  protoPath: join(__dirname, "./chat.proto"),
  package: "chat",
})
export class ChatService {
  @GrpcStreamMethod()
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
import { join } from "node:path";

const grpc = GrpcModule.forRoot({
  server: { url: "0.0.0.0:50051", package: "hero", protoPath: join(__dirname, "./hero.proto") },
});

// Start
await grpc.start();

// Get instances
const server = grpc.getServer();
const client = grpc.getClient("hero");

// Stop
await grpc.stop();
```

## Credentials, TLS, and Auth

**There is no `@Guard`/`@Roles` equivalent for gRPC.** HTTP's guard/RBAC
layer (`@Guard`, `@Roles` from `@heliosjs/middlewares`) doesn't apply here —
securing a gRPC service means TLS at the transport level plus reading
per-call metadata by hand inside each method.

### TLS

Both `GrpcServer` and `GrpcClient` default to plaintext
(`ServerCredentials.createInsecure()` / `credentials.createInsecure()`) and
log a warning when they do — worth noticing in your server logs during
development, worth fixing before anything crosses a network you don't
control:

```typescript
import { GrpcServer } from "@heliosjs/grpc";
import { ServerCredentials } from "@grpc/grpc-js";
import { readFileSync } from "node:fs";

const server = new GrpcServer({
  url: "0.0.0.0:50051",
  credentials: ServerCredentials.createSsl(
    readFileSync("ca.pem"), // root CA, or null to use the system trust store
    [{ private_key: readFileSync("server-key.pem"), cert_chain: readFileSync("server-cert.pem") }],
    false // set true to require and verify a client certificate (mTLS)
  ),
});
```

```typescript
import { GrpcClient } from "@heliosjs/grpc";
import { credentials } from "@grpc/grpc-js";
import { readFileSync } from "node:fs";

const client = new GrpcClient({
  url: "api.example.com:50051",
  package: "hero",
  protoPath: join(__dirname, "./hero.proto"),
  credentials: credentials.createSsl(readFileSync("ca.pem")),
});
```

### Reading auth from metadata

A `@GrpcMethod`/`@GrpcStreamMethod` handler receives `(request, metadata,
call)` — `metadata` is a real `Metadata` instance (grpc's equivalent of HTTP
headers), not something Helios adds. Read a token the same way a client
would set one:

```typescript
import { GrpcService, GrpcMethod } from "@heliosjs/grpc";
import type { Metadata } from "@grpc/grpc-js";
import { ForbiddenError } from "@heliosjs/core/utils";

@GrpcService("UserService", { protoPath: "./user.proto", package: "user" })
class UserService {
  @GrpcMethod()
  findOne(data: { id: number }, metadata: Metadata) {
    const [token] = metadata.get("authorization");
    if (token !== "expected-token") throw new ForbiddenError("Invalid token");
    return { id: data.id, name: "User " + data.id };
  }
}
```

A thrown error here goes through the same `normalizeError` path any other
handler error does — the client sees a real gRPC error status, not a hang.
There's no per-method decorator for this (no `@Guard` here), so this check
has to be the first line of every method that needs it, or factored into a
shared function each handler calls.

## Remarks

- `@GrpcService` stores metadata via reflect-metadata
- `@GrpcMethod` auto-discovers the service name from the class decorator
- `@InjectGrpcClient` requires the client to be registered in `GrpcModule.forRoot()`
- Client methods return RxJS Observables
- Use `toPromise()` from `@heliosjs/grpc` to convert Observables to Promises

## Related

- [gRPC Module Documentation](./module) — `GrpcModule.forRoot()`, grouping a
  server with named clients
- [gRPC API Reference](./api) — every exported type and utility
- [gRPC Examples](./examples) — a fuller worked example
