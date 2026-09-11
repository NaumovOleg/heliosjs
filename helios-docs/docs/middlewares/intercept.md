---
description: Transform a handler's return value after it resolves with @Intercept.
---

# Intercept Middleware Decorator

The `@Intercept` decorator transforms a handler's return value before it's
sent as the response.

## Purpose

An interceptor runs **after** the route handler returns — it receives
whatever the handler (or the previous interceptor) produced and returns the
value that replaces it. This makes `@Intercept` the place for response
shaping, wrapping, or caching a handler's output — not for logic that must
run *before* the handler (use [`@Use`](./use.md) or [`@Guard`](./guard.md)
for that).

## Signature

```typescript
type InterceptorCB = (data: unknown, req?: Request, res?: Response) => Promise<unknown> | unknown;
```

`data` is the value to transform — it is **not** a context object, and there
is no `next()` to call. Return the (possibly modified) value.

## Basic Usage

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Intercept } from "@heliosjs/middlewares";

@Intercept((data) => ({ data, timestamp: Date.now() }))
@Controller("/users")
export class UserController {
  @Get("/")
  findAll() {
    return [{ id: 1, name: "Alice" }];
  }
}
// GET /users → { data: [{ id: 1, name: "Alice" }], timestamp: 1700000000000 }
```

## Method-Level Interceptor

```typescript
@Controller("/users")
export class UserController {
  @Get("/")
  @Intercept(async (data, req) => ({ ...data, path: req?.path }))
  findAll() {
    return { users: [] };
  }
}
```

## Execution Order

Interceptors run **after** the handler, and when several apply to one route
they run **innermost first**: any method-level interceptor runs before the
controller's class-level ones, and among interceptors stacked on the same
target, the one written closest to the class/method (the bottom-most
`@Intercept` in the stack) runs first. Each interceptor's return value
becomes the next one's `data`.

```typescript
@Controller("/api")
@Intercept((data) => {
  console.log("outer");
  return { ...data, outer: true };
})
@Intercept((data) => {
  console.log("inner");
  return { ...data, inner: true };
})
export class ApiController {
  @Get("/")
  handler() {
    console.log("handler");
    return {};
  }
}
// Order: handler → "inner" → "outer"
// Response: { inner: true, outer: true }
```

There is no equivalent "before the handler" phase — if you need code to run
before the handler and don't need to change what it returns, that's a
[`@Use`](./use.md) middleware instead.

## Real-World Examples

### Response Envelope

Wrap every response in a consistent shape:

```typescript
@Intercept((data) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
}))
@Controller("/api")
export class ApiController {
  @Get("/users")
  getUsers() { return [{ id: 1, name: "Alice" }]; }
}
// Response: { success: true, data: [{ id: 1, name: "Alice" }], timestamp: "..." }
```

### Redacting Fields

```typescript
const redactPassword = (data: any) => {
  if (Array.isArray(data)) return data.map(({ password, ...rest }) => rest);
  if (data && typeof data === "object") {
    const { password, ...rest } = data;
    return rest;
  }
  return data;
};

@Intercept(redactPassword)
@Controller("/users")
export class UserController {
  @Get("/:id")
  findOne() {
    return { id: 1, name: "Alice", password: "hashed..." };
  }
}
// Response: { id: 1, name: "Alice" }
```

### Timing / Performance Logging

An interceptor sees the request via its second argument, so it can log
alongside the transform — but since it only runs after the handler resolves,
it measures handler-to-interceptor time, not the full request:

```typescript
const timingInterceptor = (data: any, req: any) => {
  const duration = Date.now() - req.startTime; // req.startTime is set by the framework
  if (duration > 1000) {
    console.warn(`Slow request: ${req.method} ${req.path} (${duration.toFixed(2)}ms)`);
  }
  return data;
};

@Intercept(timingInterceptor)
@Controller("/api")
export class ApiController {}
```

### Adding Response Headers

An interceptor can also read/write `res` — useful for headers that depend on
the final payload:

```typescript
const addHeadersInterceptor = (data: any, req: any, res: any) => {
  res.setHeader("X-Powered-By", "HeliosJS");
  res.setHeader("X-Request-Id", req.requestId ?? "unknown");
  return data;
};

@Intercept(addHeadersInterceptor)
@Controller("/api")
export class ApiController {}
```

### Simple Response Caching

Because an interceptor only sees the handler's *result*, it can't skip
calling the handler — use it to populate a cache after the fact, not to
short-circuit before the handler runs (a [`@Use`](./use.md) middleware that
doesn't call `next()` is the right tool for that):

```typescript
const cache = new Map<string, unknown>();

const cacheInterceptor = (ttlMs: number) => (data: any, req: any) => {
  if (req.method === "GET") {
    const key = req.path + JSON.stringify(req.query);
    cache.set(key, data);
    setTimeout(() => cache.delete(key), ttlMs);
  }
  return data;
};

@Controller("/products")
export class ProductController {
  @Get("/")
  @Intercept(cacheInterceptor(60_000))
  findAll() { return fetchProducts(); }
}
```

## What `@Intercept` Is Not For

- **Authentication/authorization** — the handler has already run by the time
  an interceptor sees its result, so it's too late to block anything. Use
  [`@Guard`](./guard.md) or [`@Roles`](./roles.md).
- **Catching handler errors** — a thrown error skips interceptors entirely
  and goes to [`@Catch`](./catch.md) handlers instead; interceptors only ever
  see a successful return value.
- **Code that must run before the handler** — use [`@Use`](./use.md).

## Remarks

- Interceptors only run on a **successful** handler return — a thrown error
  bypasses them.
- Multiple interceptors compose innermost-first; each receives the previous
  one's return value.
- Applying `@Intercept` at the class level covers every route in the
  controller (and stacks with any method-level interceptor on top).
