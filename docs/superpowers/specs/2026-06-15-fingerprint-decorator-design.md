# Fingerprint Decorator — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

Add request fingerprinting to HeliosJS. A stable fingerprint is derived from
request attributes (client IP, User-Agent, headers), hashed, and made available
two ways: injected into a handler parameter via `@Fingerprint()`, and/or
proactively attached to request state via `@UseFingerprint()` so downstream
guards/interceptors can read it. Composition is configurable (component set with
a sensible default, per-decorator override, and a global custom `compute`
override); hashing is HMAC-SHA-256 when a server secret is configured, plain
SHA-256 otherwise.

## Goals

- `@Fingerprint()` parameter decorator that injects the computed fingerprint
  into a controller method argument.
- `@UseFingerprint()` controller/method decorator that computes and attaches the
  fingerprint to request state for downstream consumers.
- Configurable composition: built-in component set (default), per-decorator
  component override, and a global `compute(req)` override.
- HMAC-SHA-256 with an optional configured secret; plain SHA-256 fallback.
- Framework-consistent: config wired through `@Server` (http) and the Lambda
  adapter options (aws), via a module-level singleton in `core` — mirrors the
  RBAC extractor holder.

## Non-Goals

- No enforcement/blocking (no fingerprint-mismatch guard). This feature is
  passive: compute + expose. A binding/enforcement guard can build on it later.
- No persistence or session binding.
- No client-side (browser) fingerprinting — server-derived only.

## Background

- Param decorators are created via `createParamDecorator(type, …)`
  (`core/src/utils/core/endpoint.ts`), which records `{ index, type }` into route
  metadata. The handler arg resolver (`core/src/utils/core/controller.ts:60-95`)
  switches on `param.type` to produce each argument. `ParamDecoratorType`
  (`core/src/types/core/common.ts:30`) is the union of valid types. Existing
  param decorators (`@Body`, `@Query`, `@Params`, `@Req`, `@Headers`) live in
  `core/src/decorators.ts`.
- The request pipeline `beforeRequest` (`controller.ts:228-264`) iterates
  `route.functions` and, per item, runs `sanitizer`, `guard`, `pipe`, then
  `middleware` `(req, res, next)`. A `middleware` item can mutate the request
  (e.g. `setState`) without blocking. `@Use` (`middlewares/src/use.ts`) registers
  such middleware items.
- `Request` (`core/src/types/core/request.ts`) exposes `getClientIp()`,
  `userAgent`, `getHeader(name)`, and `setState/getState` for per-request data.
  It has no `user` or `fingerprint` field.
- The RBAC feature established the pattern this design mirrors: a module-level
  singleton in `core` (`utils/core/rbac.ts`: `set/getRolesExtractor`), a shared
  config type in `core` consumed by http (`@Server`) and aws
  (`LambdaOptions`), registered at each adapter's bootstrap.

## Architecture

### 1. Compute core (`core`)

**Types — `core/src/types/core/fingerprint.ts`:**
```ts
import type { Request } from './request';

export type FingerprintComponent =
  | 'ip'
  | 'userAgent'
  | 'acceptLanguage'
  | 'acceptEncoding';

export interface FingerprintConfig {
  /** When set, components are HMAC-SHA-256'd with this secret; else plain SHA-256. */
  secret?: string;
  /** Component set to hash. Defaults to DEFAULT_COMPONENTS when omitted. */
  components?: FingerprintComponent[];
  /** Full override: compute the fingerprint string directly, bypassing components + hashing. */
  compute?: (req: Request) => string;
}
```

**Util + holder — `core/src/utils/core/fingerprint.ts`:**
```ts
import { createHash, createHmac } from 'node:crypto';
import type { Request } from '../../types/core/request';
import type {
  FingerprintComponent,
  FingerprintConfig,
} from '../../types/core/fingerprint';

export const DEFAULT_COMPONENTS: FingerprintComponent[] = [
  'ip',
  'userAgent',
  'acceptLanguage',
];

const toStr = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v.join(',') : (v ?? '');

const COMPONENT_EXTRACTORS: Record<FingerprintComponent, (req: Request) => string> = {
  ip: (req) => req.getClientIp(),
  userAgent: (req) => req.userAgent ?? '',
  acceptLanguage: (req) => toStr(req.getHeader('accept-language')),
  acceptEncoding: (req) => toStr(req.getHeader('accept-encoding')),
};

let config: FingerprintConfig | undefined;

export function setFingerprintConfig(cfg: FingerprintConfig | undefined): void {
  config = cfg;
}

export function getFingerprintConfig(): FingerprintConfig | undefined {
  return config;
}

export function computeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const cfg = config ?? {};
  if (cfg.compute) return cfg.compute(req);

  const components = overrideComponents ?? cfg.components ?? DEFAULT_COMPONENTS;
  const raw = components.map((c) => COMPONENT_EXTRACTORS[c](req)).join('|');

  return cfg.secret
    ? createHmac('sha256', cfg.secret).update(raw).digest('hex')
    : createHash('sha256').update(raw).digest('hex');
}

export function getOrComputeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const existing = req.getState<string>('fingerprint');
  if (existing) return existing;
  const fp = computeFingerprint(req, overrideComponents);
  req.setState('fingerprint', fp);
  return fp;
}
```

Exported through `utils/core` + `types/core` barrels and `core/src/index.ts`.

### 2. Param injection `@Fingerprint()` (`core`)

- Add `'fingerprint'` to the `ParamDecoratorType` union
  (`core/src/types/core/common.ts:30`).
- In `core/src/decorators.ts`:
  ```ts
  export const Fingerprint = () => createParamDecorator('fingerprint');
  ```
- In the arg resolver `core/src/utils/core/controller.ts` (alongside the other
  `param.type` cases, ~line 66-85):
  ```ts
  if (param.type === 'fingerprint') {
    value = getOrComputeFingerprint(request);
  }
  ```
  Lazy: computes + caches on first read, so the param works whether or not
  `@UseFingerprint()` ran first.

### 3. Attach `@UseFingerprint()` (`middlewares`)

`middlewares/src/fingerprint.ts` — controller/method decorator that registers a
non-blocking `middleware` item (mirrors `use.ts`):
```ts
import type { FingerprintComponent } from '@heliosjs/core/types';
import { defineMiddlewaresMeta, getOrComputeFingerprint } from '@heliosjs/core/utils';

export interface UseFingerprintOptions {
  components?: FingerprintComponent[];
}

export function UseFingerprint(options: UseFingerprintOptions = {}) {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    getOrComputeFingerprint(req, options.components);
    next();
  };

  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = [{ middleware }];
    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
```
(`Request`, `Response`, `NextFunction` imported from `@heliosjs/core/types`.)
Exported from `middlewares/src/index.ts`.

> Note on the per-decorator `components` override vs. the param's lazy compute:
> `getOrComputeFingerprint` caches in state. If `@UseFingerprint({ components })`
> runs first, it seeds the cache with the override; a later `@Fingerprint()`
> param read returns that cached value. If only `@Fingerprint()` is used, it
> computes with the global/default components. This is the intended precedence.

### 4. Config wiring

- **http** — `core`'s `FingerprintConfig` added to `ServerConfig`
  (`http/src/types/http/http.ts`): `fingerprint?: FingerprintConfig` (imported
  from `@heliosjs/core/types`). In the `Helios` constructor
  (`http/src/Helios.ts`), after `resolveConfig`:
  ```ts
  if (this.config.fingerprint) {
    setFingerprintConfig(this.config.fingerprint);
  }
  ```
- **aws** — `LambdaOptions` (`aws/src/types/aws/lambda.ts`) gains
  `fingerprint?: FingerprintConfig`. In the `Helios` constructor
  (`aws/src/lambda.ts`), after `super()`:
  ```ts
  if (options?.fingerprint) {
    setFingerprintConfig(options.fingerprint);
  }
  ```
  Guarded (only set when provided) to avoid clobbering across instances — same
  decision as the RBAC extractor.

### 5. Error behavior

Fingerprinting is passive and never blocks a request. Missing components resolve
to `''` (never throw). A custom `compute` override is trusted to return a string.
No new error types.

## Data Flow

```
Request
  → beforeRequest
    → (optional) @UseFingerprint middleware: getOrComputeFingerprint(req[, components])
        → computeFingerprint (compute override | components → join → hmac/sha256)
        → setState('fingerprint', fp)
    → handler arg resolution
        → @Fingerprint() param: getOrComputeFingerprint(req)  // cached or lazy compute
```

## File-Change Summary

| Package     | File                                      | Change                                                   |
| ----------- | ----------------------------------------- | -------------------------------------------------------- |
| core        | `src/types/core/fingerprint.ts` (new)     | `FingerprintComponent`, `FingerprintConfig`              |
| core        | `src/utils/core/fingerprint.ts` (new)     | extractors, holder, `computeFingerprint`, `getOrComputeFingerprint` |
| core        | `src/types/core/common.ts`                | add `'fingerprint'` to `ParamDecoratorType`              |
| core        | `src/decorators.ts`                       | `Fingerprint` param decorator                            |
| core        | `src/utils/core/controller.ts`            | `'fingerprint'` case in arg resolver                     |
| core        | `src/types/core/index.ts`, `utils/core/index.ts`, `src/index.ts` | barrels + public exports          |
| middlewares | `src/fingerprint.ts` (new)                | `UseFingerprint` decorator                               |
| middlewares | `src/index.ts`                            | export `fingerprint`                                     |
| http        | `src/types/http/http.ts`                  | `ServerConfig.fingerprint?`                              |
| http        | `src/Helios.ts`                           | `setFingerprintConfig(config.fingerprint)` (guarded)     |
| aws         | `src/types/aws/lambda.ts`                 | `LambdaOptions.fingerprint?`                             |
| aws         | `src/lambda.ts`                           | `setFingerprintConfig(options.fingerprint)` (guarded)    |
| __tests__   | `__tests__/core/fingerprint.test.ts` (new)| compute + holder + resolver behavior                     |
| __tests__   | `__tests__/middlewares/use-fingerprint.test.ts` (new) | attach decorator behavior                    |

## Testing

- `computeFingerprint`: default components produce a stable hex hash; identical
  requests → identical fingerprint; differing component values → different.
- Per-call `overrideComponents` changes the result.
- Global `components` config respected when no override.
- `secret` configured → output equals an independently computed HMAC-SHA-256;
  no secret → equals SHA-256.
- Custom `compute` override → returned verbatim, bypassing hashing.
- Header normalization: `string[]` header joined; missing component → `''`.
- `getOrComputeFingerprint`: caches in state (extractor/compute invoked once
  across repeated reads).
- Param resolver: a route with a `'fingerprint'` param yields the computed value
  with no `@UseFingerprint` present (lazy path).
- `@UseFingerprint()`: registers a `middleware` metadata item that, when run,
  sets `getState('fingerprint')`; `{ components }` override seeds the cache.
- Holder `set/getFingerprintConfig` set/clear semantics.

## Open Questions

None. All design decisions resolved during brainstorming.
