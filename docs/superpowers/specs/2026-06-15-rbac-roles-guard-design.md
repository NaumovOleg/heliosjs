# RBAC `@Roles` Guard — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

Add role-based access control (RBAC) to HeliosJS. Developers restrict
controllers and routes by role with a `@Roles(...)` decorator. The decorator
is a guard factory built on the existing guard pipeline. User roles are read
through a configurable extractor registered globally in `@Server`.

## Goals

- `@Roles('admin')` one-liner on a controller or route method.
- Multiple roles with selectable match mode: ANY (default) or ALL.
- Framework-agnostic: how to obtain a user's roles is supplied by the app via
  a configurable extractor (`getRoles(req)`), not assumed.
- Reuse the existing guard execution path. No change to the core `Request`
  interface.

## Non-Goals

- No permission/scope model beyond role names (no `@Permissions`).
- No built-in user/identity population. Establishing the authenticated user is
  the job of a prior auth guard; RBAC only reads roles.
- No persistence, role hierarchy, or wildcard matching.

## Background

Current guard architecture:

- `@Guard(guard)` decorator (`middlewares/src/guard.ts`) attaches guard
  metadata via `defineMiddlewaresMeta`, on class or method.
- `runGuard(guard, request, response)` (`core/src/utils/core/controller.ts`)
  runs the guard. Guard forms: `GuardFunction`, `GuardClass`, `GuardInstance`.
  A guard returning `false` → `ForbiddenError`. A `GuardFunction` returning a
  `string` → `ForbiddenError` with that string as message.
- Guards receive only `(request, response)` — no route metadata / Reflector.
- `Request` (`core/src/types/core/request.ts`) has no `user` field; it exposes
  `setState/getState` for per-request data.
- Global config comes from `@Server(config)` (`http/src/decorators.ts`) →
  `resolveConfig` → `ServerConfig` (`http/src/types/http/http.ts`), consumed in
  `http/src/Helios.ts`.

Because guards do not get route metadata, the pure NestJS split (`@Roles`
metadata + Reflector-based `RolesGuard`) is not a natural fit. Instead `@Roles`
is a **guard factory**: it closes over the required roles and reads a
globally-registered extractor.

## Architecture

### 1. Public API

```ts
@Roles('admin')                               // single role
@Roles('admin', 'editor')                     // ANY (default): admin OR editor
@Roles(['admin', 'editor'], { mode: 'all' })  // ALL: admin AND editor
@Roles('admin', { message: 'Admins only' })   // custom forbidden message
```

- Applies to a controller class or a route method (the existing guard pipeline
  already supports both targets).
- Signature accepts roles as varargs strings **or** a single `string[]`, with an
  optional trailing options object.

```ts
interface RolesOptions {
  mode?: 'any' | 'all'; // default 'any'
  message?: string;     // default 'Insufficient role'
}

function Roles(
  ...args: [...(string | string[])[], RolesOptions?] | (string | string[])[]
): ClassDecorator & MethodDecorator;
```

Implementation normalizes `args` into `requiredRoles: string[]` and `options`.

### 2. Extractor configuration

Roles are obtained via a configurable extractor, supplied globally in
`@Server`:

```ts
@Server({
  rbac: {
    getRoles: (req) => req.getState('user')?.roles ?? [],
  },
})
class App {}
```

Types. `RolesExtractor` is defined in **core** (section 3) so both the holder
and the guard share it. `RBACConfig` lives in `http/src/types/http/http.ts`
alongside `ServerConfig` and imports `RolesExtractor` from core:

```ts
// core: src/types/core/...
type RolesExtractor = (
  req: Request,
) => string | string[] | undefined | Promise<string | string[] | undefined>;

// http: src/types/http/http.ts
import type { RolesExtractor } from '@heliosjs/core/types';

interface RBACConfig {
  getRoles: RolesExtractor;
}

interface ServerConfig {
  // ...existing fields...
  rbac?: RBACConfig;
}
```

### 3. Extractor holder (in `core`)

`core` is a shared dependency of both `http` and `middlewares`, so the holder
lives there and bridges bootstrap (http) to the guard (middlewares).

New module, e.g. `core/src/utils/core/rbac.ts`:

```ts
let extractor: RolesExtractor | undefined;

export function setRolesExtractor(fn: RolesExtractor | undefined): void {
  extractor = fn;
}

export function getRolesExtractor(): RolesExtractor | undefined {
  return extractor;
}
```

`RolesExtractor` type defined in core (re-used by http's `RBACConfig`).
Exported from `core/src/index.ts`.

### 4. Bootstrap wiring

In `http/src/Helios.ts` constructor, after `resolveConfig`:

```ts
setRolesExtractor(this.config.rbac?.getRoles);
```

### 5. Guard logic

New file `middlewares/src/roles.ts`. `Roles(...)` builds a `GuardFunction`
closure and registers it through `defineMiddlewaresMeta` (same pattern as
`guard.ts`).

```ts
export function Roles(/* ...roles, options */) {
  const { requiredRoles, options } = normalize(args);
  const mode = options.mode ?? 'any';
  const message = options.message ?? 'Insufficient role';

  const guard: GuardFunction = async (req) => {
    const extractor = getRolesExtractor();
    if (!extractor) {
      throw new InvalidStateError(
        'RBAC extractor not set; configure rbac.getRoles in @Server',
      );
    }
    const raw = await extractor(req);
    const userRoles = raw == null ? [] : Array.isArray(raw) ? raw : [raw];

    const ok =
      mode === 'all'
        ? requiredRoles.every((r) => userRoles.includes(r))
        : requiredRoles.some((r) => userRoles.includes(r));

    return ok ? true : message; // string return → ForbiddenError(message)
  };

  // register via defineMiddlewaresMeta on class or method (per guard.ts)
}
```

Export `Roles` from `middlewares/src/index.ts`.

### 6. Error behavior

| Condition                         | Result                                  |
| --------------------------------- | --------------------------------------- |
| User has required role(s) per mode| Pass                                    |
| Insufficient / no matching roles  | `ForbiddenError` (403), `message`       |
| Extractor returns empty/undefined | Treated as no roles → 403               |
| Extractor not configured          | `InvalidStateError` (misconfiguration)  |

No 401 path: establishing the authenticated identity is the prior auth guard's
responsibility; RBAC only authorizes.

## Data Flow

```
Request
  → beforeRequest (core/utils/core/controller.ts)
    → runGuard(fn.guard, req, res)        // existing pipeline
      → Roles closure
        → getRolesExtractor()             // core holder, set at bootstrap
        → getRoles(req)                    // app-supplied
        → normalize + ANY/ALL match
        → true | message
      → message → ForbiddenError(message)
```

## File-Change Summary

| Package     | File                                | Change                                              |
| ----------- | ----------------------------------- | --------------------------------------------------- |
| core        | `src/utils/core/rbac.ts` (new)      | extractor holder + `set/getRolesExtractor`          |
| core        | `src/types/core/...`                | `RolesExtractor` type                               |
| core        | `src/utils/core/index.ts`, `index.ts`| export holder + type                               |
| http        | `src/types/http/http.ts`            | `RBACConfig` + `ServerConfig.rbac`                  |
| http        | `src/Helios.ts`                     | `setRolesExtractor(config.rbac?.getRoles)`          |
| middlewares | `src/roles.ts` (new)                | `Roles` decorator + guard closure                   |
| middlewares | `src/index.ts`                      | export `roles`                                      |

## Testing

- ANY mode: pass when one required role present; fail when none.
- ALL mode: pass when every required role present; fail when one missing.
- Single role string.
- Roles passed as `string[]`.
- Extractor returns a single `string` (normalized).
- Empty/undefined extracted roles → 403.
- Extractor not configured → `InvalidStateError`.
- Async extractor resolved correctly.
- Custom `message` surfaced in `ForbiddenError`.
- Controller-level vs method-level application.

## Open Questions

None. All design decisions resolved during brainstorming.
