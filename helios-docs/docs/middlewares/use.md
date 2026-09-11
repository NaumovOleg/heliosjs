---
description: Register (req, res, next) middleware functions that run before the route handler with @Use.
---

# Use Middleware Decorator

The `@Use` decorator registers middleware functions that execute before the route handler.

## Purpose

Middlewares are functions that run before your handler. They can modify the request/response, perform authentication, logging, or short-circuit the request by not calling `next()`.

## Signature

```typescript
type MiddlewareCB = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | Request | Promise<Request>;
```

## Basic Usage

```typescript
import { Use } from "@heliosjs/middlewares";
import { Controller, Get } from "@heliosjs/core";

// Single middleware
@Use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
})
@Controller("/users")
export class UserController {
  @Get("/")
  findAll() { return []; }
}
```

## Multiple Middlewares

```typescript
import { Use } from "@heliosjs/middlewares";

@Use([loggingMiddleware, authMiddleware, rateLimitMiddleware])
@Controller("/admin")
export class AdminController {}
```

Middlewares execute in array order: `loggingMiddleware` → `authMiddleware` → `rateLimitMiddleware`.

## Method-Level Middleware

```typescript
import { Controller, Get, Post } from "@heliosjs/core";
import { Use } from "@heliosjs/middlewares";

@Controller("/users")
export class UserController {
  @Get("/")
  findAll() { return []; }

  @Post("/")
  @Use(validateBodyMiddleware)
  create() { return { created: true }; }
}
```

## Composing Class + Method Middlewares

Class-level and method-level middlewares are merged. Class-level runs first:

```typescript
@Use(authMiddleware)           // runs first for ALL routes
@Controller("/users")
export class UserController {
  @Get("/")
  list() { return []; }       // authMiddleware → (no method middleware)

  @Post("/")
  @Use(validateMiddleware)     // runs after authMiddleware
  create() { return {}; }     // authMiddleware → validateMiddleware
}
```

## Real-World Examples

### Logging Middleware

`req`/`res` here are the framework `Request`/`Response`, not raw Node
objects — there's no `res.on('finish', ...)` to hook into. Log from an
`@Intercept` instead, which runs once the handler has actually produced a
result (and `req.startTime` is the request's high-resolution start time):

```typescript
import { Intercept } from "@heliosjs/middlewares";

const loggingInterceptor = (data: any, req: any, res: any) => {
  const duration = Date.now() - req.startTime; // req.startTime is set by the framework
  console.log(`${req.method} ${req.path} ${res.status} ${duration}ms`);
  return data;
};

@Intercept(loggingInterceptor)
@Controller("/api")
export class ApiController {}
```

### Authentication Middleware

```typescript
import { UnauthorizedError } from "@heliosjs/core";

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.getHeader("authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new UnauthorizedError("Missing authentication token");
  }

  try {
    const user = verifyToken(token);
    req.setState("user", user);
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
};

@Use(authMiddleware)
@Controller("/protected")
export class ProtectedController {
  @Get("/profile")
  profile(@Req() req: any) {
    return req.getState("user");
  }
}
```

### Request ID Middleware

```typescript
import { generateUniqueId } from "@heliosjs/core/utils";

const requestIdMiddleware = (req: any, res: any, next: any) => {
  const requestId = req.getHeader("x-request-id") || generateUniqueId();
  req.setState("requestId", requestId);
  res.setHeader("X-Request-Id", requestId);
  next();
};

@Use(requestIdMiddleware)
@Controller("/api")
export class ApiController {}
```

### Body Size Limiter

```typescript
import { PayloadTooLargeError } from "@heliosjs/core";

const bodySizeLimit = (maxBytes: number) => (req: any, res: any, next: any) => {
  const contentLength = Number(req.getHeader("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new PayloadTooLargeError(`Body exceeds ${maxBytes} bytes`);
  }
  next();
};

@Controller("/upload")
export class UploadController {
  @Post("/")
  @Use(bodySizeLimit(10 * 1024 * 1024)) // 10MB
  upload() { return { ok: true }; }
}
```

### Short-Circuiting (Returning Early)

A middleware can short-circuit the pipeline by sending a response without calling `next()`:

```typescript
const cacheMiddleware = (req: any, res: any, next: any) => {
  const cached = cache.get(req.path);
  if (cached) {
    // Set the payload and don't call next() — the pipeline stops here and
    // the adapter still sends whatever res.data currently holds.
    res.data = cached;
    return;
  }
  next(); // No cache, continue to handler
};
```

## Metadata Handling

The decorator attaches middleware metadata to the target class or method. The framework reads this metadata during request processing to execute middlewares in order.

## Remarks

- Middlewares execute in the order they are defined
- Can be applied at both class and method levels
- Class-level runs before method-level
- Useful for logging, authentication, request modification, and cross-cutting concerns
- A middleware can stop the pipeline by not calling `next()`
