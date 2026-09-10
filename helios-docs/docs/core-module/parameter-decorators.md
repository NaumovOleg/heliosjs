---
sidebar_position: 6
---

# Routing & Parameters

HeliosJS provides powerful routing with decorators. Every parameter decorator injects data directly into your handler method.

## Route Decorators

| Decorator | HTTP Method | Description |
|-----------|-------------|-------------|
| `@Get(path)` | GET | Retrieve data |
| `@Post(path)` | POST | Create resources |
| `@Put(path)` | PUT | Replace resource |
| `@Patch(path)` | PATCH | Partial update |
| `@Delete(path)` | DELETE | Remove resource |
| `@Options(path)` | OPTIONS | Get allowed methods |
| `@Head(path)` | HEAD | Get headers only |
| `@Query(path)` | QUERY | Idempotent query with body |
| `@Any()` | * | Catch-all |

```typescript
import { Controller, Get, Post, Put, Patch, Delete, Options, Head, Query } from "@heliosjs/core";

@Controller("/resources")
export class ResourceController {
  @Get("/")
  findAll() { return []; }

  @Post("/")
  create(@Body() data: any) { return data; }

  @Put("/:id")
  replace(@Param("id") id: string, @Body() data: any) { return data; }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() data: any) { return data; }

  @Delete("/:id")
  remove(@Param("id") id: string) { return { deleted: true }; }

  @Options("/")
  allowed() { return { methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }; }

  @Head("/:id")
  exists(@Param("id") id: string) { /* returns only headers */ }

  @Query("/search")
  search(@Body() filter: any) { return { results: [] }; }
}
```

## URL Parameters (@Param)

Extract dynamic segments from the URL:

```typescript
import { Controller, Get, Param } from "@heliosjs/core";

@Controller("/users")
export class UserController {
  // /users/123
  @Get("/:id")
  getUser(@Param("id") id: string) {
    return { id: Number(id) };
  }

  // /users/123/posts/456
  @Get("/:userId/posts/:postId")
  getUserPost(
    @Param("userId") userId: string,
    @Param("postId") postId: string,
  ) {
    return { userId: Number(userId), postId: Number(postId) };
  }

  // /users/123/posts (nested)
  @Get("/:userId/posts")
  getUserPosts(@Param("userId") userId: string) {
    return { userId: Number(userId), posts: [] };
  }
}
```

## Query Parameters (@QueryParam)

Extract query string parameters from the URL:

```typescript
import { Controller, Get, QueryParam } from "@heliosjs/core";

@Controller("/products")
export class ProductController {
  // GET /products?page=1&limit=10&search=laptop&sort=price
  @Get("/")
  findAll(
    @QueryParam("page") page?: string,
    @QueryParam("limit") limit?: string,
    @QueryParam("search") search?: string,
    @QueryParam("sort") sort?: string,
  ) {
    return {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search || "",
      sort: sort || "name",
    };
  }

  // GET /products/filter?category=electronics&minPrice=100&maxPrice=500
  @Get("/filter")
  filter(
    @QueryParam("category") category?: string,
    @QueryParam("minPrice") minPrice?: string,
    @QueryParam("maxPrice") maxPrice?: string,
  ) {
    return {
      category,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    };
  }

  // GET /products/all - get all query params as object
  @Get("/all")
  allParams(@QueryParam() query: Record<string, string>) {
    return { filters: query };
  }
}
```

## Request Body (@Body)

Extract and optionally validate the request body:

```typescript
import { Controller, Post, Body } from "@heliosjs/core";

interface CreateUserDto {
  name: string;
  email: string;
  age?: number;
}

@Controller("/users")
export class UserController {
  @Post("/")
  create(@Body() data: CreateUserDto) {
    return { id: 1, ...data };
  }

  // Extract specific field
  @Post("/email-only")
  emailOnly(@Body("email") email: string) {
    return { email };
  }

  // With DTO validation
  @Post("/validated")
  validated(@Body(CreateUserDto) data: CreateUserDto) {
    return { id: 1, ...data };
  }
}
```

## Headers (@Headers)

Extract HTTP headers:

```typescript
import { Controller, Get, Headers } from "@heliosjs/core";

@Controller("/auth")
export class AuthController {
  // Single header
  @Get("/token")
  getToken(@Headers("authorization") auth: string) {
    return { token: auth?.replace("Bearer ", "") };
  }

  // Multiple headers
  @Get("/info")
  getInfo(
    @Headers("user-agent") userAgent: string,
    @Headers("accept-language") lang: string,
    @Headers("x-request-id") requestId: string,
  ) {
    return { userAgent, lang, requestId };
  }

  // All headers
  @Get("/all")
  allHeaders(@Headers() headers: Record<string, string>) {
    return { headers };
  }
}
```

## Cookies (@Cookies)

Extract cookies from the request:

```typescript
import { Controller, Get, Cookies } from "@heliosjs/core";

@Controller("/session")
export class SessionController {
  // Single cookie
  @Get("/me")
  getSession(@Cookies("sessionId") sessionId: string) {
    return { sessionId };
  }

  // All cookies
  @Get("/all")
  allCookies(@Cookies() cookies: Record<string, string>) {
    return { cookies };
  }
}
```

## Request Object (@Req)

Access the full request object:

```typescript
import { Controller, Get, Req, Request } from "@heliosjs/core";

@Controller("/debug")
export class DebugController {
  @Get("/request")
  debugRequest(@Req() req: Request) {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: req.headers,
      query: req.query,
      body: req.body,
      params: req.params,
      clientIp: req.getClientIp(),
      userAgent: req.userAgent,
      requestId: req.requestId,
    };
  }

  // Read from request state (set by middleware)
  @Get("/state")
  getState(@Req() req: Request) {
    const user = req.getState("user");
    const fingerprint = req.getState("fingerprint");
    return { user, fingerprint };
  }

  // Write to request state
  @Get("/set-state")
  setState(@Req() req: Request) {
    req.setState("customValue", { key: "value" });
    return { success: true };
  }
}
```

## Response Object (@Res)

Manual response control:

```typescript
import { Controller, Get, Res, Response } from "@heliosjs/core";

@Controller("/response")
export class ResponseController {
  @Get("/custom-status")
  customStatus(@Res() res: Response) {
    return { status: 201, data: { created: true } };
  }

  @Get("/with-headers")
  withHeaders(@Res() res: Response) {
    res.setHeader("X-Custom-Header", "hello");
    res.setHeader("Cache-Control", "no-cache");
    return { data: "with custom headers" };
  }

  @Get("/with-cookie")
  withCookie(@Res() res: Response) {
    res.setCookie("session", "abc123", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 86400,
    });
    return { data: "cookie set" };
  }

  @Get("/redirect")
  redirect(@Res() res: Response) {
    res.redirect("/new-location", 301);
  }

  @Get("/html")
  html(@Res() res: Response) {
    return res.html("<h1>Hello World</h1>");
  }

  @Get("/text")
  text(@Res() res: Response) {
    return res.text("plain text response");
  }
}
```

## Request Fingerprint (@Fingerprint)

Inject a computed hash derived from request attributes:

```typescript
import { Controller, Get, Fingerprint } from "@heliosjs/core";

@Controller("/session")
export class SessionController {
  @Get("/")
  current(@Fingerprint() fp: string) {
    return { fingerprint: fp };
  }
}
```

The fingerprint is computed from IP, User-Agent, and Accept-Language by default. See [Fingerprint Decorator](../middlewares/fingerprint.md) for configuration.

## Multipart Form Data (@Files)

Extract uploaded files:

```typescript
import { Controller, Post, Files, Body } from "@heliosjs/core";

@Controller("/upload")
export class UploadController {
  @Post("/")
  upload(
    @Files("avatar") avatar: any,
    @Body() metadata: { description: string },
  ) {
    return {
      uploaded: true,
      fileName: avatar?.filename,
      size: avatar?.size,
      description: metadata?.description,
    };
  }

  // Multiple files
  @Post("/multiple")
  uploadMultiple(
    @Files("documents") documents: any[],
  ) {
    return {
      count: documents?.length || 0,
      files: documents?.map((f) => ({ name: f.filename, size: f.size })),
    };
  }
}
```

## QUERY Requests (@Query)

`QUERY` is a safe, idempotent HTTP method that carries a request body. Use it for complex search filters that don't fit in a URL:

```typescript
import { Controller, Query, Body } from "@heliosjs/core";

interface SearchFilter {
  categories: string[];
  priceRange: { min: number; max: number };
  inStock: boolean;
}

@Controller("/products")
export class ProductController {
  @Query("/search")
  search(@Body() filter: SearchFilter) {
    return { matched: filter.categories.length };
  }
}
```

:::warning
`QUERY` requires Node.js 20.20+ (llhttp 9.2+). On AWS, it passes through ALB, Lambda Function URLs, and CloudFront, but not API Gateway.
:::

## Combined Example

A controller using every parameter type:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  QueryParam,
  Headers,
  Cookies,
  Req,
  Res,
  Fingerprint,
  Request,
  Response,
  NotFoundError,
} from "@heliosjs/core";

interface Product {
  id: number;
  name: string;
  price: number;
}

let products: Product[] = [];

@Controller("/products")
export class ProductController {
  @Get("/")
  findAll(
    @QueryParam("category") category?: string,
    @QueryParam("minPrice") minPrice?: string,
    @QueryParam("maxPrice") maxPrice?: string,
    @Headers("accept-language") lang?: string,
  ) {
    let filtered = [...products];

    if (category) {
      filtered = filtered.filter((p) => p.name.includes(category));
    }
    if (minPrice) {
      filtered = filtered.filter((p) => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    }

    return { data: filtered, lang: lang || "en" };
  }

  @Get("/:id")
  findOne(
    @Param("id") id: string,
    @Fingerprint() fingerprint: string,
  ) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) {
      throw new NotFoundError("Product", id);
    }
    return { ...product, requestedBy: fingerprint };
  }

  @Post("/")
  create(
    @Body() data: Omit<Product, "id">,
    @Headers("authorization") auth: string,
    @Cookies("sessionId") sessionId: string,
  ) {
    const product: Product = { id: products.length + 1, ...data };
    products.push(product);
    return product;
  }

  @Get("/debug/full")
  fullDebug(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return {
      method: req.method,
      path: req.path,
      ip: req.getClientIp(),
      requestId: req.requestId,
    };
  }
}
```

## Parameter Summary

| Decorator | Source | Usage |
|-----------|--------|-------|
| `@Param(name?)` | URL path | `/users/:id` → `@Param('id')` |
| `@QueryParam(name?)` | Query string | `?page=1` → `@QueryParam('page')` |
| `@Body(nameOrDto?)` | Request body | JSON payload |
| `@Headers(name?)` | HTTP headers | Authorization header |
| `@Cookies(name?)` | Cookie header | Session cookie |
| `@Files(name?)` | Multipart data | File uploads |
| `@Req()` | Raw request | Full Request object |
| `@Res()` | Raw response | Full Response object |
| `@Fingerprint()` | Computed | Hashed request fingerprint |
| `@Params(dto?)` | URL params | Validated route params |

## Route Priority

Routes are matched by specificity. More specific routes should come before parameterized ones:

```typescript
@Controller("/users")
export class UserController {
  // Fixed path - matched first
  @Get("/profile")
  getProfile() { return { page: "profile" }; }

  // Fixed path - matched second
  @Get("/settings")
  getSettings() { return { page: "settings" }; }

  // Parameterized path - matched last
  @Get("/:id")
  getUser(@Param("id") id: string) { return { userId: id }; }
}
```
