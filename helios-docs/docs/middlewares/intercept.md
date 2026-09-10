# Intercept Middleware Decorator

The `@Intercept` decorator wraps route handlers with before/after logic.

## Purpose

Interceptors let you run code before and after a handler executes. They receive a `next` function that invokes the handler, giving you full control over the request lifecycle.

## Signature

```typescript
type InterceptorCB = (data: any, req?: Request, res?: Response) => Promise<unknown> | unknown;
```

## Basic Usage

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Intercept } from "@heliosjs/middlewares";

@Intercept(async (data, req, res) => {
  console.log("Before handler");
  const result = await data.next();
  console.log("After handler");
  return result;
})
@Controller("/users")
export class UserController {
  @Get("/")
  findAll() { return []; }
}
```

## Method-Level Interceptor

```typescript
@Controller("/users")
export class UserController {
  @Get("/")
  @Intercept(async (data, req, res) => {
    const start = Date.now();
    const result = await data.next();
    console.log(`GET /users took ${Date.now() - start}ms`);
    return result;
  })
  findAll() { return []; }
}
```

## Real-World Examples

### Response Transformation

```typescript
@Intercept(async (data) => {
  const result = await data.next();

  // Wrap all responses in a standard envelope
  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
})
@Controller("/api")
export class ApiController {
  @Get("/users")
  getUsers() { return [{ id: 1, name: "Alice" }]; }
}
// Response: { success: true, data: [{ id: 1, name: "Alice" }], timestamp: "..." }
```

### Timing / Performance Logging

```typescript
const timingInterceptor = async (data: any, req: any) => {
  const start = performance.now();

  try {
    const result = await data.next();
    return result;
  } finally {
    const duration = performance.now() - start;
    console.log(`${req.method} ${req.path} - ${duration.toFixed(2)}ms`);

    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path}`);
    }
  }
};

@Intercept(timingInterceptor)
@Controller("/api")
export class ApiController {}
```

### Caching

```typescript
const cache = new Map<string, { data: any; expiry: number }>();

const cacheInterceptor = (ttlMs: number) => async (data: any, req: any) => {
  if (req.method !== "GET") {
    return data.next(); // Only cache GET requests
  }

  const key = req.path + JSON.stringify(req.query);
  const cached = cache.get(key);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const result = await data.next();
  cache.set(key, { data: result, expiry: Date.now() + ttlMs });
  return result;
};

@Controller("/products")
export class ProductController {
  @Get("/")
  @Intercept(cacheInterceptor(60_000)) // Cache for 1 minute
  findAll() { return fetchProducts(); }
}
```

### Error Recovery

```typescript
const retryInterceptor = async (data: any, req: any) => {
  try {
    return await data.next();
  } catch (error) {
    console.error("Handler failed, returning fallback:", error.message);
    return { fallback: true, message: "Service temporarily unavailable" };
  }
};

@Controller("/api")
export class ApiController {
  @Get("/external")
  @Intercept(retryInterceptor)
  fetchExternal() {
    return callExternalService(); // Might fail
  }
}
```

### Authorization Check

```typescript
const roleInterceptor = (requiredRole: string) => async (data: any, req: any) => {
  const user = req.getState("user");

  if (!user || user.role !== requiredRole) {
    throw new ForbiddenError(`${requiredRole} access required`);
  }

  return data.next();
};

@Controller("/admin")
@Intercept(roleInterceptor("admin"))
export class AdminController {
  @Get("/dashboard")
  dashboard() { return { stats: {} }; }
}
```

### Adding Response Headers

```typescript
const addHeadersInterceptor = async (data: any, req: any, res: any) => {
  const result = await data.next();

  res.setHeader("X-Powered-By", "HeliosJS");
  res.setHeader("X-Request-Id", req.requestId || "unknown");

  return result;
};

@Intercept(addHeadersInterceptor)
@Controller("/api")
export class ApiController {}
```

## Stacking Multiple Interceptors

Interceptors wrap each other in order (outermost runs first):

```typescript
@Controller("/api")
@Intercept(async (data) => {
  console.log("1: before");
  const result = await data.next();
  console.log("1: after");
  return result;
})
@Intercept(async (data) => {
  console.log("2: before");
  const result = await data.next();
  console.log("2: after");
  return result;
})
export class ApiController {
  @Get("/")
  handler() {
    console.log("handler");
    return {};
  }
}
// Output: 1: before → 2: before → handler → 2: after → 1: after
```

## Remarks

- Interceptors wrap the handler execution, enabling before/after logic
- They can modify the result returned by the handler
- Multiple interceptors compose in declaration order
- Common use cases: logging, caching, response transformation, timing, authorization
