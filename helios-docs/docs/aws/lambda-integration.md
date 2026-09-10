---
sidebar_position: 12
---

# AWS Lambda Integration

The `Helios` adapter from `@heliosjs/aws` translates AWS Lambda events into HeliosJS controller calls. It supports API Gateway (v1/v2), ALB, CloudFront, and Lambda Function URLs.

## Basic Setup

```typescript
import { Controller, Get, Post, Body, Param } from "@heliosjs/core";
import { Helios } from "@heliosjs/aws";

@Controller("/users")
export class UserController {
  private users = [{ id: 1, name: "Alice" }];

  @Get("/")
  findAll() { return this.users; }

  @Get("/:id")
  findOne(@Param("id") id: string) {
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
export const handler = adapter.handler;
```

## Adapter Options

```typescript
import { Helios } from "@heliosjs/aws";

const adapter = new Helios(RootController, {
  rbac: {
    getRoles: (req) => req.getState("user")?.roles ?? [],
  },
  fingerprint: {
    secret: process.env.FP_SECRET,
    components: ["ip", "userAgent"],
  },
});
```

| Option | Type | Description |
|--------|------|-------------|
| `rbac` | `{ getRoles: (req) => roles }` | Roles extractor for `@Roles` |
| `fingerprint` | `{ secret?, components?, compute? }` | Fingerprint config |

## Supported Event Types

| Event Source | Description |
|-------------|-------------|
| API Gateway v1 | REST API (`APIGatewayProxyEvent`) |
| API Gateway v2 | HTTP API (`APIGatewayProxyEventV2`) |
| ALB | Application Load Balancer |
| CloudFront | Lambda@Edge |
| Lambda Function URL | Direct function invocation |

## Full CRUD Example

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  QueryParam,
  Headers,
  NotFoundError,
  ValidationError,
} from "@heliosjs/core";
import { Helios } from "@heliosjs/aws";

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
  findOne(@Param("id") id: string) {
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
  replace(@Param("id") id: string, @Body() data: Omit<Product, "id">) {
    const index = products.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new NotFoundError("Product", id);
    products[index] = { id: Number(id), ...data };
    return products[index];
  }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() data: Partial<Product>) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) throw new NotFoundError("Product", id);
    Object.assign(product, data);
    return product;
  }

  @Delete("/:id")
  remove(@Param("id") id: string) {
    const index = products.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new NotFoundError("Product", id);
    products.splice(index, 1);
    return { deleted: true };
  }
}

const adapter = new Helios(ProductController);
export const handler = adapter.handler;
```

## Lambda with Plugins

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Helios, Plugin } from "@heliosjs/aws";

const loggingPlugin: Plugin = {
  name: "logging",
  onInit(app, event, context) {
    console.log("Lambda cold start", context.functionName);
  },
  hooks: {
    afterResponse(req, res) {
      console.log("Request completed");
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

export const handler = adapter.handler;
```

## TypeScript Types

```typescript
import { LambdaEvent } from "@heliosjs/aws";

// The handler signature matches AWS Lambda
export const handler: LambdaHandler = async (event: LambdaEvent, context) => {
  return adapter.handler(event, context);
};
```

## Remarks

- The exported `handler` works directly as an AWS Lambda function handler
- The adapter normalizes events from API Gateway, ALB, CloudFront, and Function URLs
- Controllers are identical to HTTP server controllers
- Plugins can hook into the Lambda lifecycle via `onInit`, `beforeRequest`, `afterResponse`
- RBAC and fingerprint work the same as in HTTP servers
