---
description: Role-based access control on controllers and routes with @Roles, built on the guard pipeline.
---

# Roles (RBAC) Decorator

The `@Roles` decorator adds role-based access control (RBAC) to controllers and routes. It restricts access to users that hold one or more required roles, building on the same guard pipeline as [`@Guard`](./guard.md).

## Purpose

`@Roles` declares which roles are allowed to reach a controller or route handler. On each request the framework reads the current user's roles through a configurable **extractor**, compares them against the required roles, and either lets the request continue or rejects it with a `403 Forbidden`.

Because `@Roles` is framework-agnostic about *where* roles come from, it works with any auth strategy (JWT claims, session store, custom header, database lookup) — you provide a single `getRoles(req)` function.

## How It Works

1. You register a global **roles extractor** once, via `@Server({ rbac })` (HTTP) or the Lambda adapter options (AWS).
2. `@Roles(...)` attaches a guard to the controller/route.
3. On each request the guard calls `getRoles(req)`, normalizes the result to a list, and checks it against the required roles using the selected **match mode**.
4. If the check fails, the guard throws `ForbiddenError` (`403`). If no extractor was configured, it throws `InvalidStateError` — a configuration error surfaced loudly.

## Configuring the Roles Extractor

The extractor returns the role(s) for the current request as a `string`, `string[]`, or `undefined` — synchronously or as a `Promise`.

### HTTP — `@Server({ rbac })`

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [UserController],
  rbac: {
    // Read roles from a user object that an upstream auth guard attached.
    getRoles: (req) => req.getState("user")?.roles ?? [],
  },
})
export class App {}
```

### AWS Lambda

```typescript
import { Helios } from "@heliosjs/aws";

const adapter = new Helios(RootController, {
  rbac: {
    getRoles: (req) => req.getState("user")?.roles ?? [],
  },
});

export const handler = adapter.handler;
```

> The extractor is registered when the application is constructed. A typical setup pairs `@Roles` with an authentication guard or middleware that first populates the user (for example `req.setState('user', decodedJwt)`).

## Usage

### Single role

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Roles } from "@heliosjs/middlewares";

@Controller("/admin")
@Roles("admin")
export class AdminController {
  @Get("/dashboard")
  dashboard() {
    return { ok: true };
  }
}
```

### Multiple roles — ANY (default)

The request passes if the user holds **at least one** of the listed roles.

```typescript
@Controller("/posts")
@Roles("editor", "admin") // editor OR admin
export class PostController {}
```

### Multiple roles — ALL

Require **every** listed role with `{ mode: 'all' }`.

```typescript
@Roles(["billing", "admin"], { mode: "all" }) // billing AND admin
@Get("/invoices")
invoices() {
  return this.invoiceService.findAll();
}
```

### Custom forbidden message

```typescript
@Roles("admin", { message: "Admins only" })
@Delete("/:id")
remove(@Params("id") id: string) {}
```

### Controller-level (global) and method-level (local)

`@Roles` works at both levels and they compose. A controller-level decorator applies to **every** route in the controller; a method-level decorator applies to that route only.

```typescript
@Controller("/projects")
@Roles("member") // baseline: every route requires "member"
export class ProjectController {
  @Get("/")
  list() {}

  @Delete("/:id")
  @Roles("admin") // this route additionally requires "admin"
  remove(@Params("id") id: string) {}
}
```

### Reading roles from a JWT

```typescript
import jwt from "jsonwebtoken";

@Server({
  controllers: [App],
  rbac: {
    getRoles: (req) => {
      const token = req.getHeader("authorization")?.toString().replace("Bearer ", "");
      if (!token) return [];
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { roles?: string[] };
      return payload.roles ?? [];
    },
  },
})
export class AppWithJwt {}
```

## Match Modes

| Mode    | Behavior                                            | How to select                       |
| ------- | --------------------------------------------------- | ----------------------------------- |
| `any`   | Pass if the user has **at least one** required role | Default                             |
| `all`   | Pass only if the user has **every** required role   | `@Roles([...], { mode: 'all' })`    |

## API Reference

### `@Roles(...roles, options?)`

| Argument   | Type                          | Description                                                              |
| ---------- | ----------------------------- | ----------------------------------------------------------------------- |
| `roles`    | `string \| string[]` (varargs)| One or more required roles, as variadic strings or a single array.      |
| `options`  | `RolesOptions`                | Optional trailing options object.                                       |

### `RolesOptions`

| Property  | Type              | Default               | Description                                        |
| --------- | ----------------- | --------------------- | -------------------------------------------------- |
| `mode`    | `'any' \| 'all'`  | `'any'`               | Whether the user needs any or all listed roles.    |
| `message` | `string`          | `'Insufficient role'` | Message used for the `403 Forbidden` response.     |

### `RBACConfig` (the `rbac` option)

| Property   | Type                                                                       | Description                                            |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `getRoles` | `(req: Request) => string \| string[] \| undefined \| Promise<...>`        | Returns the role(s) for the current request.          |

## Error Behavior

| Condition                          | Result                                |
| ---------------------------------- | ------------------------------------- |
| User holds the required role(s)    | Request proceeds                      |
| Insufficient / no matching roles   | `ForbiddenError` (`403`)              |
| Extractor returns empty/`undefined`| Treated as no roles → `403`           |
| No `rbac.getRoles` configured      | `InvalidStateError` (misconfiguration)|

## Remarks

- `@Roles` is authorization only — establishing *who* the user is remains the job of an upstream authentication guard or middleware.
- The extractor is global per process and set once at bootstrap. Configure it before serving requests.
- Roles passed as varargs (`@Roles('a', 'b')`) and as an array (`@Roles(['a', 'b'])`) are equivalent.

## Related

- [`@Guard`](./guard.md) — the lower-level access-control primitive `@Roles` builds on.
- [`@UseFingerprint` / `@Fingerprint`](./fingerprint.md) — request fingerprinting.
