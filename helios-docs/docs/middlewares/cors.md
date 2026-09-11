---
description: Configure Cross-Origin Resource Sharing per controller or route with @Cors.
---

# Cors Middleware Decorator

The `@Cors` decorator configures Cross-Origin Resource Sharing (CORS) for controllers or methods.

## Purpose

CORS controls which origins can access your API. It handles preflight `OPTIONS` requests and sets the appropriate response headers.

## Basic Usage

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Cors } from "@heliosjs/middlewares";

// Allow all origins (default)
@Cors()
@Controller("/public")
export class PublicController {
  @Get("/")
  data() { return { public: true }; }
}
```

## Custom Configuration

```typescript
@Cors({
  origin: "https://example.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
})
@Controller("/api")
export class ApiController {}
```

## CORSConfig Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `origin` | `string \| string[] \| ((origin: string) => boolean)` | `*` | Allowed origin(s), or a predicate deciding per-request |
| `methods` | `string[]` | all methods | Allowed HTTP methods |
| `allowedHeaders` | `string[]` | all headers | Allowed request headers |
| `exposedHeaders` | `string[]` | none | Headers exposed to the browser |
| `credentials` | `boolean` | `false` | Allow credentials (cookies, auth headers) |
| `maxAge` | `number` | `86400` | Preflight cache duration in seconds |
| `optionsSuccessStatus` | `number` | `204` | Status code for successful OPTIONS |

## Real-World Examples

### Allow Multiple Origins

```typescript
@Cors({
  origin: ["https://app.example.com", "https://admin.example.com"],
  credentials: true,
})
@Controller("/api")
export class ApiController {}
```

### Credentials (Cookies/Auth)

```typescript
@Cors({
  origin: "https://myapp.com",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
})
@Controller("/auth")
export class AuthController {
  @Post("/login")
  login() {
    return { token: "..." };
  }
}
```

### Per-Method CORS

```typescript
@Controller("/users")
export class UserController {
  // Public read-only endpoint
  @Get("/")
  @Cors({ origin: "*" })
  findAll() { return []; }

  // Restricted write endpoint
  @Post("/")
  @Cors({
    origin: "https://admin.example.com",
    methods: ["POST"],
    credentials: true,
  })
  create() { return { created: true }; }
}
```

### Dynamic Origin

`origin` also accepts a synchronous predicate — `(origin: string) => boolean`
— for validation logic that a fixed list can't express (subdomain matching,
an allow-list from a database loaded at startup, etc.):

```typescript
import { Server } from "@heliosjs/http";

const allowedOrigins = ["https://example.com", "https://app.example.com"];

@Server({
  controllers: [ApiController],
  cors: {
    origin: (origin) => allowedOrigins.includes(origin),
    credentials: true,
  },
})
export class App {}
```

Works the same way on `@Cors` at the controller/method level.

## Remarks

- The default origin is `*`, allowing all origins
- The default `optionsSuccessStatus` is `204` for legacy browser compatibility
- `credentials: true` requires explicit `origin` (not `*`)
- Applying at class level affects all routes; method-level overrides for that route
