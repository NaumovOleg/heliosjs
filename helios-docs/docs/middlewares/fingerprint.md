---
description: Compute and inject a hashed request fingerprint with @Fingerprint() and @UseFingerprint().
---

# Fingerprint Decorator

Request fingerprinting derives a stable identifier from request attributes (client IP, User-Agent, headers), hashes it, and exposes it to your application. HeliosJS provides two complementary decorators:

- **`@Fingerprint()`** — a parameter decorator that injects the fingerprint into a handler argument.
- **`@UseFingerprint()`** — a controller/method decorator that attaches the fingerprint to request state so guards, interceptors, and other middleware can read it.

## Purpose

A fingerprint is useful for rate limiting, anomaly/abuse detection, soft session binding, and request correlation. The fingerprint is computed from a configurable set of **components**, hashed with HMAC-SHA-256 when a secret is configured (otherwise SHA-256), and is **passive** — it never blocks a request.

## How It Works

1. You optionally register global fingerprint configuration via `@Server({ fingerprint })` (HTTP) or the Lambda adapter options (AWS).
2. The fingerprint is computed by joining the selected component values and hashing them.
3. The value is cached in request state under the `fingerprint` key, so it is computed at most once per request regardless of how many times it is read.

## Components

| Component        | Source                                  |
| ---------------- | --------------------------------------- |
| `ip`             | `req.getClientIp()`                     |
| `userAgent`      | `req.userAgent`                         |
| `acceptLanguage` | `accept-language` header                |
| `acceptEncoding` | `accept-encoding` header                |

The default component set is `['ip', 'userAgent', 'acceptLanguage']`. Missing component values contribute an empty string; array header values are joined with `,`.

## Configuration

Configuration is optional — with no configuration, the default components are hashed with SHA-256.

### HTTP — `@Server({ fingerprint })`

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [UserController],
  fingerprint: {
    secret: process.env.FP_SECRET, // enables HMAC-SHA-256
    components: ["ip", "userAgent"], // override the default component set
  },
})
export class App {}
```

### AWS Lambda

```typescript
import { Helios } from "@heliosjs/aws";

const adapter = new Helios(RootController, {
  fingerprint: { secret: process.env.FP_SECRET },
});

export const handler = adapter.handler;
```

### Custom `compute` override

For full control, supply a `compute` function. It bypasses the component set and hashing entirely and returns the fingerprint string directly.

```typescript
@Server({
  controllers: [App],
  fingerprint: {
    compute: (req) =>
      [req.getClientIp(), req.getHeader("x-device-id")].join(":"),
  },
})
export class AppWithCustomCompute {}
```

## Usage

### Inject into a handler — `@Fingerprint()`

The parameter decorator computes the fingerprint lazily (and caches it), so it works whether or not `@UseFingerprint()` ran first.

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

### Attach for downstream guards/interceptors — `@UseFingerprint()`

Use the controller/method decorator when something *other than the handler* — a guard, an interceptor, a rate-limiter — needs the fingerprint. It computes and stores it in request state early, without blocking the request.

```typescript
import { Controller, Post } from "@heliosjs/core";
import { UseFingerprint } from "@heliosjs/middlewares";

@Controller("/auth")
@UseFingerprint()
export class AuthController {
  @Post("/login")
  login() {
    // A guard or interceptor on this controller can read
    // req.getState("fingerprint").
  }
}
```

### Reading the attached value in a guard

```typescript
import { Guard } from "@heliosjs/middlewares";

@UseFingerprint()
@Guard((req) => {
  const fp = req.getState<string>("fingerprint");
  return rateLimiter.allow(fp); // boolean
})
@Controller("/api")
export class ApiController {}
```

### Per-decorator component override

`@UseFingerprint()` accepts a `components` override for its scope:

```typescript
@UseFingerprint({ components: ["ip", "userAgent", "acceptLanguage", "acceptEncoding"] })
@Controller("/strict")
export class StrictController {}
```

## API Reference

### `@Fingerprint()`

Parameter decorator. Injects the computed fingerprint (`string`) into the decorated handler argument. Takes no arguments.

### `@UseFingerprint(options?)`

Controller/method decorator. Registers a non-blocking middleware that computes and attaches the fingerprint to request state.

| Option       | Type                     | Description                                          |
| ------------ | ------------------------ | ---------------------------------------------------- |
| `components` | `FingerprintComponent[]` | Override the component set for this scope.            |

### `FingerprintConfig` (the `fingerprint` option)

| Property     | Type                         | Default                                  | Description                                                          |
| ------------ | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `secret`     | `string`                     | —                                        | When set, components are hashed with HMAC-SHA-256; else SHA-256.     |
| `components` | `FingerprintComponent[]`     | `['ip', 'userAgent', 'acceptLanguage']`  | Component set to hash.                                               |
| `compute`    | `(req: Request) => string`   | —                                        | Full override: returns the fingerprint directly, bypassing hashing. |

`FingerprintComponent` is one of `'ip' | 'userAgent' | 'acceptLanguage' | 'acceptEncoding'`.

## Security Notes

- Configure a strong `secret` in production. HMAC-SHA-256 prevents trivial precomputation and cross-service correlation of fingerprints.
- A fingerprint is a heuristic signal, not a secure identity. Do not use it as the sole authentication or authorization factor — pair it with real auth (see [`@Roles`](./roles.md)).
- Component values such as IP and User-Agent can change legitimately (mobile networks, proxies, browser updates). Choose the component set to match how strict you need correlation to be.

## Remarks

- The fingerprint is cached per request, so repeated reads (param + guard + interceptor) compute it once.
- Fingerprinting never throws on missing components and never blocks a request.
- `@Fingerprint()` alone is enough for the common case; reach for `@UseFingerprint()` only when a non-handler consumer needs the value.

## Related

- [Routing & Parameters](../core-module/parameter-decorators.md) — all parameter decorators, including `@Fingerprint`.
- [`@Roles`](./roles.md) — role-based access control.
- [`@Guard`](./guard.md) — request guards that can consume the fingerprint.
