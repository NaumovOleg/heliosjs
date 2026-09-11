---
description: Set the HTTP status code for a successful response with @Status, or the Ok200/Ok201/Ok204 shortcuts.
---

# Status Decorator

The `@Status` decorator sets the HTTP status code a **successful** handler
response is sent with — without touching the `Response` object.

## Purpose

By default a successful handler returns `200`. `@Status` lets you declare a
different success status declaratively, right next to the route, instead of
setting it imperatively with `@Res()`. It only affects the success path:
thrown errors still carry the status of their `HeliosError`, and
`res.redirect()` keeps its own status code.

## Signature

```typescript
function Status(status: number): ClassDecorator | MethodDecorator;
```

## Basic Usage

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { Status } from "@heliosjs/middlewares";

@Controller("/users")
export class UserController {
  @Post("/")
  @Status(201)
  create(@Body() data: { name: string }) {
    return { id: 1, ...data }; // sent with HTTP 201
  }
}
```

## Class-Level Default

Applied to a controller, `@Status` sets the default for every route in it;
a method-level `@Status` overrides it for that one route:

```typescript
@Controller("/events")
@Status(202) // every route defaults to 202 Accepted
export class EventController {
  @Post("/")
  create() {
    return { queued: true }; // 202
  }

  @Get("/:id")
  @Status(200) // override back to 200 for this route
  findOne() {
    return { id: 1 };
  }
}
```

## Shortcuts

`Ok200()`, `Ok201()`, `Ok204()` are thin aliases for the common cases:

```typescript
import { Controller, Post, Delete, Body } from "@heliosjs/core";
import { Ok201, Ok204 } from "@heliosjs/middlewares";

@Controller("/users")
export class UserController {
  @Post("/")
  @Ok201() // same as @Status(201)
  create(@Body() data: { name: string }) {
    return { id: 1, ...data };
  }

  @Delete("/:id")
  @Ok204() // same as @Status(204)
  remove() {
    return; // empty body, 204 No Content
  }
}
```

## Remarks

- `@Status` only sets the status for a **successful** return; it has no
  effect on thrown errors.
- Method-level wins over class-level.
- For anything beyond a fixed status code — conditional status, headers,
  cookies — use [`@Res()`](../core-module/parameter-decorators.md#response-object-res)
  and set `res.status` directly.

## Related

- [Routing & Parameters — `@Res()`](../core-module/parameter-decorators.md#response-object-res)
- [Error Handling](../core-module/error.md) — how error status codes are decided.
