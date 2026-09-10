# Pipe Middleware Decorator

The `@Pipe` decorator transforms request data before it reaches the handler.

## Purpose

Pipes modify `body`, `query`, `params`, or `headers` data before validation and handler execution. They receive raw data and must return the transformed value.

## Signature

```typescript
interface Pipe {
  body?: (body: any) => any;
  query?: (query: Record<string, string>) => Record<string, string>;
  params?: (params: Record<string, string>) => Record<string, string>;
  headers?: (headers: Record<string, string>) => Record<string, string>;
}
```

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
@Pipe({
  params: (params) => ({
    ...params,
    slug: params.slug?.toLowerCase().replace(/[^a-z0-9-]/g, ""),
  }),
})
@Controller("/articles")
export class ArticleController {
  @Get("/:slug")
  findBySlug(@Param("slug") slug: string) {
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
