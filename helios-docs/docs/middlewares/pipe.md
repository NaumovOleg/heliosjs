---
description: Transform body, query, params, or headers before validation and the handler with @Pipe.
---

# Pipe Middleware Decorator

The `@Pipe` decorator transforms request data before it reaches the handler.

## Purpose

Pipes modify `body`, `query`, `params`, or `headers` data before validation and handler execution. They receive raw data and must return the transformed value.

## Signature

```typescript
interface Pipe {
  body?: (body: any, request: Request) => any;
  query?: (query: Record<string, string | string[]>, request: Request) => Record<string, string | string[]>;
  params?: (params: Record<string, string>, request: Request) => Record<string, string>;
  headers?: (headers: Record<string, string | string[]>, request: Request) => Record<string, string | string[]>;
}
```

Each function's second argument is the current `Request`, in case the
transform needs more context than the field being replaced.

## Basic Usage

```typescript
import { Controller, Get, Post, Body, QueryParam } from "@heliosjs/core";
import { Pipe } from "@heliosjs/middlewares";

@Pipe({
  body: (body) => ({
    ...body,
    name: body.name?.trim(),
    email: body.email?.toLowerCase(),
  }),
  query: (query) => ({
    ...query,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 10,
  }),
})
@Controller("/users")
export class UserController {
  @Get("/")
  findAll(@QueryParam("page") page: number, @QueryParam("limit") limit: number) {
    return { page, limit };
  }

  @Post("/")
  create(@Body() data: { name: string; email: string }) {
    return { id: 1, ...data };
  }
}
```

## Real-World Examples

### Type Coercion

```typescript
@Pipe({
  query: (query) => ({
    ...query,
    page: String(Math.max(1, Number(query.page) || 1)),
    limit: String(Math.min(100, Math.max(1, Number(query.limit) || 10))),
    active: query.active === "true" ? "true" : "false",
  }),
})
@Controller("/items")
export class ItemController {
  @Get("/")
  list(
    @QueryParam("page") page: string,
    @QueryParam("limit") limit: string,
    @QueryParam("active") active: string,
  ) {
    return { page: Number(page), limit: Number(limit), active: active === "true" };
  }
}
```

### URL Slug Normalization

```typescript
import { Controller, Get, Params } from "@heliosjs/core";
import { Pipe } from "@heliosjs/middlewares";

@Pipe({
  params: (params) => ({
    ...params,
    slug: params.slug?.toLowerCase().replace(/[^a-z0-9-]/g, ""),
  }),
})
@Controller("/articles")
export class ArticleController {
  @Get("/:slug")
  findBySlug(@Params("slug") slug: string) {
    return { slug };
  }
}
```

### Header Normalization

```typescript
@Pipe({
  headers: (headers) => ({
    ...headers,
    "accept-language": headers["accept-language"]?.split(",")[0] || "en",
    authorization: headers["authorization"]?.replace("Bearer ", "") || "",
  }),
})
@Controller("/api")
export class ApiController {}
```

### Combining Body and Query Pipes

```typescript
@Pipe({
  body: (body) => ({
    ...body,
    name: body.name?.trim(),
    tags: Array.isArray(body.tags) ? body.tags.map((t: string) => t.toLowerCase()) : [],
  }),
  query: (query) => ({
    ...query,
    sort: ["name", "date", "price"].includes(query.sort) ? query.sort : "name",
    order: ["asc", "desc"].includes(query.order) ? query.order : "asc",
  }),
})
@Controller("/products")
export class ProductController {
  @Post("/")
  create(@Body() data: any) { return data; }

  @Get("/")
  list(@QueryParam("sort") sort: string, @QueryParam("order") order: string) {
    return { sort, order };
  }
}
```

## Composed with a Guard and a Validated DTO

A realistic route rarely uses just one middleware decorator. Here's the
shape a production "create user" endpoint actually has — an auth guard, a
pipe that normalizes raw input, and a `class-validator` DTO — and, more
importantly, *why* they're layered in this order. Per the [Request
Lifecycle](../core-module/request-lifecycle), guards run before pipes, and
pipes run before parameter validation: an unauthenticated request never
reaches the (comparatively expensive) normalization/validation work, and
validation sees the *piped* value, not the raw one — so `"  Bob@EXAMPLE.com  "`
gets trimmed and lowercased by the pipe before `@IsEmail()` ever looks at it,
instead of failing on whitespace or case:

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { Guard, Pipe } from "@heliosjs/middlewares";
import { IsEmail, IsString, MinLength } from "class-validator";

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;
}

@Guard((req) => !!req.getHeader("authorization"))
@Pipe({
  body: (body) => ({
    ...body,
    name: typeof body.name === "string" ? body.name.trim() : body.name,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : body.email,
  }),
})
@Controller("/users")
export class UserController {
  @Post("/")
  create(@Body(CreateUserDto) data: CreateUserDto) {
    // Unauthenticated requests never get here. `data.email` is already
    // trimmed and lowercased — @IsEmail() validated the cleaned value.
    return { id: 1, ...data };
  }
}
```

The same layering works with [`@Sanitize`](./sanitize) instead of `@Pipe` —
sanitizers run even earlier (stage 4, before guards), so a sanitizer is the
right tool when invalid data should never reach a guard's authorization
logic at all, not just the handler.

## Method-Level Pipe

```typescript
@Controller("/users")
export class UserController {
  @Post("/")
  @Pipe({
    body: (body) => ({
      ...body,
      name: body.name?.trim(),
      email: body.email?.toLowerCase().trim(),
    }),
  })
  create(@Body() data: any) {
    return data;
  }
}
```

## Remarks

- Pipes execute before controller methods
- Each function receives raw data and must return the transformed value
- Apply at class level for all routes, or method level for specific routes
- Common use cases: type casting, normalization, trimming, default values

## Related

- [Guard](./guard) — runs before pipes; reject a request before spending any
  normalization/validation work on it
- [Sanitize](./sanitize) — Joi-based alternative that runs even earlier
  (before guards), for data that shouldn't reach authorization logic at all
- [Validation with DTOs](../core-module/validation) — `@Body(SomeDto)`
  validates the *piped* value, not the raw one
- [Request Lifecycle](../core-module/request-lifecycle) — the full pipeline
  order this page's composed example depends on
