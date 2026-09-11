---
description: Control access to a controller or route with a function, class, or instance guard using @Guard.
---

# Guard Decorator

The `@Guard` decorator registers a guard that controls access to a controller or route handler.

## Purpose

Guards validate incoming requests before they reach route handlers — they are the gatekeepers that decide whether a request may proceed. A guard runs in the request pipeline and either allows the request or rejects it with a `403 Forbidden`.

Guards are the foundation for authentication and authorization. For role-based access control specifically, prefer the higher-level [`@Roles`](./roles.md) decorator, which is built on `@Guard`.

## Usage

Apply `@Guard` to a controller class or a route method, passing a guard **function**, a guard **class**, or a guard **instance**.

## Guard Return Values

A guard signals its decision through its return value (or its `canActivate` result):

| Return value      | Effect                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `true`            | Request proceeds.                                                |
| `false`           | Request is rejected with `403 Forbidden` (default message).      |
| `string`          | Request is rejected with `403 Forbidden`, using the string as the message. |
| `Promise<...>`    | Awaited, then resolved value is interpreted as above.            |

## Parameters

- `guard: GuardFunction | GuardClass | GuardInstance` — the guard used to decide whether the request is allowed to proceed.

## Examples

### Function guard

```typescript
import { Controller } from "@heliosjs/core";
import { Guard } from "@heliosjs/middlewares";

@Guard((req, res) => {
  // Allow only if an Authorization header is present.
  return !!req.getHeader("authorization");
})
@Controller("/secure")
class SecureController {}
```

### Function guard with a custom message

Return a string to reject the request with that message:

```typescript
@Guard((req) => {
  return req.getHeader("authorization") ? true : "Authorization required";
})
@Controller("/secure")
class SecureController {}
```

### Async guard

Guards may be asynchronous — the framework awaits the result:

```typescript
@Guard(async (req) => {
  const token = req.getHeader("authorization")?.toString();
  return token ? await sessionStore.isValid(token) : false;
})
@Controller("/account")
class AccountController {}
```

### Class-based guard

Implement `GuardInstance` (a `canActivate` method). Returning a string sets a custom forbidden message; an optional `message` property provides a default:

```typescript
import { GuardInstance, Request, Response } from "@heliosjs/core";

class AuthGuard implements GuardInstance {
  message = "Forbidden";

  canActivate(req: Request, res: Response) {
    return !!req.getHeader("authorization");
  }
}

@Guard(AuthGuard)
@Controller("/admin")
class AdminController {}
```

### Method-level guard

Apply a guard to a single route instead of the whole controller:

```typescript
import { Controller, Get, Delete, Params } from "@heliosjs/core";
import { Guard } from "@heliosjs/middlewares";

@Controller("/posts")
class PostController {
  @Get("/")
  list() {}

  @Delete("/:id")
  @Guard((req) => req.getState("user")?.isAdmin === true)
  remove(@Params("id") id: string) {}
}
```

### Multiple guards

Apply `@Guard` more than once. All guards must pass for the request to proceed; the first to reject stops the request.

```typescript
@Guard(isAuthenticated)
@Guard(hasActiveSubscription)
@Controller("/premium")
class PremiumController {}
```

## Metadata Handling

The decorator attaches the guard as metadata on the target class or method. This metadata is read by the framework during request processing to enforce guard checks before the handler runs. Controller-level guards apply to every route in the controller; method-level guards apply to that route only.

## Remarks

- Guards run before controller methods, as part of the request pipeline.
- Use them for authentication, authorization, and request validation.
- A guard that returns `false` or a string stops request handling with `403 Forbidden`.
- For role checks, use [`@Roles`](./roles.md) instead of writing role logic by hand.

## Related

- [`@Roles`](./roles.md) — role-based access control built on guards.
- [`@UseFingerprint` / `@Fingerprint`](./fingerprint.md) — request fingerprinting that guards can consume.
- [`@Use`](./use.md) — general-purpose middleware.
