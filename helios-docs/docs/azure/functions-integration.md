---
description: The Helios adapter from @heliosjs/azure — registering it with app.http, adapter options, and a full CRUD example.
---

# Azure Functions Integration

The `Helios` adapter from `@heliosjs/azure` translates Azure Functions v4
programming model `HttpRequest`/`InvocationContext` invocations into HeliosJS
controller calls. Unlike AWS Lambda — where the adapter has to detect and
normalize four different event shapes (API Gateway v1/v2, ALB, CloudFront,
Function URL) — Azure Functions has exactly one HTTP request shape regardless
of trigger, so there's nothing to detect.

## Basic Setup

```typescript
import { app } from "@azure/functions";
import { Controller, Get, Post, Body, Params } from "@heliosjs/core";
import { Helios } from "@heliosjs/azure";

@Controller("/users")
export class UserController {
  private users = [{ id: 1, name: "Alice" }];

  @Get("/")
  findAll() { return this.users; }

  @Get("/:id")
  findOne(@Params("id") id: string) {
    return this.users.find((u) => u.id === Number(id));
  }

  @Post("/")
  create(@Body() data: { name: string }) {
    const user = { id: this.users.length + 1, ...data };
    this.users.push(user);
    return user;
  }
}

const adapter = new Helios(UserController);

app.http("api", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  authLevel: "anonymous",
  // Catch-all route: let Helios's own controller tree do the routing
  // instead of Azure's function-per-route model.
  route: "{*path}",
  handler: adapter.handler,
});
```

:::caution Default `/api` route prefix

Azure Functions v4 prepends `host.json`'s `routePrefix` (`"api"` by default)
to every HTTP-triggered route, including the `{*path}` catch-all above — so a
request to `/users` actually arrives at the handler as `/api/users`, and
Helios controllers declared at bare paths like `/users` won't match it. Set
`"extensions": { "http": { "routePrefix": "" } }` in `host.json` so the paths
your controllers declare are the paths clients actually call.

:::

## Adapter Options

```typescript
import { Helios } from "@heliosjs/azure";

const adapter = new Helios(RootController, {
  rbac: {
    getRoles: (req) => req.getState("user")?.roles ?? [],
  },
  fingerprint: {
    secret: process.env.FP_SECRET,
    components: ["ip", "userAgent"],
  },
  cors: {
    origin: ["https://example.com"],
    credentials: true,
  },
  trustProxy: true, // default — the Functions host sets X-Forwarded-*
});
```

| Option | Type | Description |
|--------|------|-------------|
| `rbac` | `{ getRoles: (req) => roles }` | Roles extractor for `@Roles` |
| `fingerprint` | `{ secret?, components?, compute? }` | Fingerprint config |
| `cors` | `CORSConfig` | Adapter-level CORS, applied regardless of routing |
| `trustProxy` | `boolean` (default `true`) | Trust `X-Forwarded-For`/`X-Forwarded-Proto` from the Functions host for `req.getClientIp()`/`req.isSecure()` |

## Routing: One Function, One Controller Tree

Azure Functions normally maps one `app.http(...)` registration to one route.
Helios controllers already do their own routing (`@Controller`, `@Get(":id")`,
wildcards, etc.), so register a single catch-all function and let the
controller tree take it from there, as in the example above — `route:
"{*path}"` with `methods` covering every verb your controllers use.

## Full CRUD Example

```typescript
import { app } from "@azure/functions";
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Params,
  QueryParam,
  Headers,
  NotFoundError,
  ValidationError,
} from "@heliosjs/core";
import { Helios } from "@heliosjs/azure";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

let products: Product[] = [];
let nextId = 1;

@Controller("/products")
export class ProductController {
  @Get("/")
  list(
    @QueryParam("category") category?: string,
    @QueryParam("minPrice") minPrice?: string,
    @QueryParam("maxPrice") maxPrice?: string,
  ) {
    let filtered = [...products];

    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (minPrice) {
      filtered = filtered.filter((p) => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    }

    return { data: filtered, total: filtered.length };
  }

  @Get("/:id")
  findOne(@Params("id") id: string) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) throw new NotFoundError("Product", id);
    return product;
  }

  @Post("/")
  create(
    @Body() data: Omit<Product, "id">,
    @Headers("authorization") auth: string,
  ) {
    if (!auth) throw new ValidationError([{ field: "authorization", constraint: "Required" }]);

    const product: Product = { id: nextId++, ...data };
    products.push(product);
    return product;
  }

  @Put("/:id")
  replace(@Params("id") id: string, @Body() data: Omit<Product, "id">) {
    const index = products.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new NotFoundError("Product", id);
    products[index] = { id: Number(id), ...data };
    return products[index];
  }

  @Patch("/:id")
  update(@Params("id") id: string, @Body() data: Partial<Product>) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) throw new NotFoundError("Product", id);
    Object.assign(product, data);
    return product;
  }

  @Delete("/:id")
  remove(@Params("id") id: string) {
    const index = products.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new NotFoundError("Product", id);
    products.splice(index, 1);
    return { deleted: true };
  }
}

const adapter = new Helios(ProductController);

app.http("products", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  authLevel: "anonymous",
  route: "{*path}",
  handler: adapter.handler,
});
```

## Azure Functions with Plugins

```typescript
import { app } from "@azure/functions";
import { Controller, Get } from "@heliosjs/core";
import { Helios, Plugin } from "@heliosjs/azure";

const loggingPlugin: Plugin = {
  name: "logging",
  hooks: {
    beforeRequest(_req, context) {
      context.log("Invocation:", context.functionName);
    },
    afterResponse(req) {
      console.log("Request completed", req.path);
    },
  },
};

@Controller("/health")
export class HealthController {
  @Get("/")
  check() { return { status: "ok" }; }
}

const adapter = new Helios(HealthController);
adapter.usePlugin(loggingPlugin);

app.http("health", { methods: ["GET"], authLevel: "anonymous", route: "{*path}", handler: adapter.handler });
```

See [Custom Plugins for Azure Functions](./plugins) for the full plugin interface and more examples.

## TypeScript Types

`adapter.handler` already **is** a standard Azure Functions v4 `HttpHandler`
— pass it straight to `app.http(...)`, no wrapping needed. `HttpRequest` and
`InvocationContext` are plain re-exports from `@azure/functions` itself;
`@heliosjs/azure` doesn't need its own event-union type the way `@heliosjs/aws`
exports `LambdaEvent` — there's only one request shape to type.

Inside a controller or plugin hook that receives the framework `Request`
(`beforeRoute`, `afterResponse`, guards, middlewares, handlers), the raw Azure
objects are still reachable when you need them:

```typescript
import type { Request } from "@heliosjs/core";

function example(req: Request) {
  req.isAzure(); // true when running on this adapter
  req.getAzureRequest(); // the raw Azure `HttpRequest`, or undefined off Azure
  req.getAzureContext(); // the Azure `InvocationContext`, or undefined off Azure
}
```

## Remarks

- The exported `handler` works directly as an Azure Functions v4 `HttpHandler`
- Register one catch-all `app.http(..., { route: "{*path}" })` and let Helios's own controller tree do the routing
- Controllers are identical to HTTP server controllers
- Plugins can hook into the invocation lifecycle via `onInit`, `beforeRequest`, `beforeRoute`, `afterResponse`
- RBAC, fingerprint, and adapter-level CORS work the same as in HTTP servers
- Request body reading is asynchronous (the Functions host exposes it as a Fetch-like `ReadableStream`) — already handled for you inside the adapter
