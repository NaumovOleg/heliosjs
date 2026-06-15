# Rate Limit Strategies — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

Add a universal, pluggable rate-limiting subsystem to HeliosJS `core`. A
`@RateLimit` decorator (method- and controller-level) enforces request limits per
client. The extension point is a two-level interface: a high-level
`RateLimitStrategy` that owns the limiting algorithm, and a low-level
`RateLimitStore` that owns the storage backend. Core ships three built-in
strategies (fixed window, sliding window, token bucket) and an in-memory store
used by default — no configuration required out of the box. Users swap only the
store (e.g. Redis) or supply a fully custom strategy. On limit breach the
subsystem sets standard `X-RateLimit-*` / `Retry-After` headers, invokes an
optional `onLimit` hook, and throws the existing `RateLimitExceededError` (429).

## Goals

- `@RateLimit(options)` decorator usable on controller methods and controller
  classes.
- Two-level extension interface:
  - `RateLimitStrategy.consume(key, ctx)` — owns the algorithm (primary
    extension point).
  - `RateLimitStore.hit(key, opts)` / `reset(key)` — owns the backend
    (convenience for "just change storage").
- Three built-in strategies: `fixedWindow`, `slidingWindow`, `tokenBucket`, each
  wrapping a `RateLimitStore`.
- `MemoryStore` shipped as the zero-dependency default store.
- Default behavior with no config: `fixedWindow(new MemoryStore())`.
- Scope + precedence: **method > controller > global**. Global default set via
  `setRateLimitConfig(...)`, mirroring `setFingerprintConfig` / RBAC extractor.
- Per-client key: defaults to the existing fingerprint
  (`getOrComputeFingerprint`), overridable via `keyGen`.
- Enforcement: always emit `X-RateLimit-Limit/Remaining/Reset`; on breach add
  `Retry-After`, call optional `onLimit(req, res)`, throw
  `RateLimitExceededError`.

## Non-Goals

- No Redis (or any external-backend) implementation shipped in core. Docs show a
  ~15-line `RateLimitStore` Redis example; users own that code.
- No distributed-coordination guarantees beyond what the user's store provides.
  `MemoryStore` is per-process only (documented).
- No automatic IP allow/deny lists, no quota billing, no dynamic limit tuning.
- No WebSocket/SSE rate limiting in this slice (HTTP route handlers only).

## Interfaces

```ts
// types/core/ratelimit.ts

export interface RateLimitRecord {
  totalHits: number; // hits used in the current window (or tokens consumed)
  remaining: number; // max - used, clamped to >= 0
  resetAt: number;   // epoch ms when the window/refill next resets
  allowed: boolean;  // whether THIS request is permitted
}

// Generic numeric state for one key. Meaning is strategy-defined:
// fixed/sliding window → count = hits used; token bucket → count = tokens left
// (fractional); resetAt → window end OR last-refill timestamp (epoch ms).
export interface RateLimitState {
  count: number;
  resetAt: number;
}

// Low-level pluggable backend: a generic per-key state store with TTL eviction.
// This is the ONLY shape all three built-in algorithms share. A Redis impl is
// ~15 lines (GET/SET-with-PX/DEL); single-process atomicity is sufficient for
// MemoryStore, and Redis users accept best-effort atomicity (or use WATCH/Lua).
export interface RateLimitStore {
  get(key: string): Promise<RateLimitState | undefined>;
  set(key: string, state: RateLimitState, ttlMs: number): Promise<void>;
  reset(key: string): Promise<void>;
}

export interface RateLimitContext {
  request: Request;
  max: number;
  windowMs: number;
  cost: number;
}

// High-level: owns the algorithm. Usually wraps a RateLimitStore.
export interface RateLimitStrategy {
  consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord>;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  strategy?: RateLimitStrategy;       // default: resolved global, else fixedWindow(MemoryStore)
  keyGen?: (req: Request) => string;  // default: getOrComputeFingerprint(req)
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
  cost?: number;                      // default 1
}

// Global default holder (subset; max/windowMs come from the decorator)
export interface RateLimitConfig {
  strategy?: RateLimitStrategy;
  keyGen?: (req: Request) => string;
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
}
```

**Design rationale.** `RateLimitStrategy` is the real seam: a custom algorithm +
backend implements one method. Most users only want a different backend, so the
built-in strategies accept a `RateLimitStore` and contain the algorithm. Strategy
beats store for flexibility; store beats strategy for ergonomics — shipping both
covers "memory / redis / something of your own."

## Built-in strategies & store

Factory functions in `utils/core/ratelimit/strategies.ts`, each returns a
`RateLimitStrategy`:

- `fixedWindow(store?)` — counter per `windowMs`, hard reset at window end.
  Default store `new MemoryStore()`.
- `slidingWindow(store?)` — weighted previous+current window count; smoother,
  no boundary bursts.
- `tokenBucket(store?, { refillRate })` — `max` = bucket capacity, `refillRate` =
  tokens/sec. Bucket-specific options live in the **factory**, not in
  `RateLimitOptions` (keeps the decorator surface algorithm-agnostic).

`MemoryStore` (`utils/core/ratelimit/store.ts`): `Map<string, { state, expireAt }>`
with **lazy expiry only** — an entry is dropped when accessed after `expireAt`.
No background timer (keeps the process clean to exit; YAGNI on periodic sweep).
Per-process only; documented as non-distributed.

All three algorithms are expressed in the strategy as `get → compute → set` over
the generic `RateLimitState`. Each strategy owns its key layout: fixed window and
token bucket use one key; sliding window uses two time-bucketed sub-keys
(`key:<windowStart>`) to read the previous window's count. A custom store only
needs to persist/return `{ count, resetAt }` and honor the TTL.

## Decorator & wiring

`@RateLimit(options)` is a **method + class decorator**. It calls
`defineMiddlewaresMeta` to append a new metadata item of type `rateLimit`
(carrying the resolved `RateLimitOptions`):

- Method-level: stored per-property (`defineMiddlewaresMeta(item, target, key)`).
- Class-level: stored on the constructor, flowing into `meta.functions` via
  `collectRoutes` (`controller.ts:301`, `[...meta.functions, ...functions]`).

New `MiddleWareItemType` member `'rateLimit'` added to
`types/core/controller.ts` (enum `MiddlewaresMetadataItemProperty`, the
`MiddleWareItemType` union, and `MiddlewareTypeMap` → `RateLimitOptions`).

**Enforcement** happens in a dedicated step inside `beforeRequest`
(`utils/core/controller.ts`), implemented in `utils/core/ratelimit/enforce.ts`:

1. Collect all `rateLimit` items from `route.functions`. Because controller-level
   items precede method-level in the array, the **last** one wins (method >
   controller). If none, fall back to the global config (`getRateLimitConfig`).
   If still nothing, no limiting.
2. Resolve effective config: merge `global → controller → method` (later
   overrides earlier) for `strategy`, `keyGen`, `onLimit`; `max`/`windowMs`/`cost`
   come from the winning decorator item. Effective `strategy` defaults to
   `fixedWindow(new MemoryStore())` (a single shared module-level instance so all
   default-config routes share storage).
3. Build the key: `keyGen(req)` (default fingerprint), prefixed with a stable
   route id (`route.method + route.route`) so each endpoint has an isolated
   bucket.
4. `const rec = await strategy.consume(key, ctx)`.
5. Always: `response.setHeaders({ 'X-RateLimit-Limit': max, 'X-RateLimit-Remaining':
   rec.remaining, 'X-RateLimit-Reset': Math.ceil(rec.resetAt / 1000) })`.
6. If `!rec.allowed`: set `Retry-After` (seconds until `resetAt`), `await
   onLimit?.(req, res)`, then `throw new RateLimitExceededError(...)`.

`RateLimitExceededError` is already whitelisted in `beforeRequest`'s catch
(`controller.ts:270`) and the `execute` catch (`controller.ts:126`), so it
propagates as a 429 without being swallowed by user error handlers.

## File layout

```
src/core/src/
  utils/core/ratelimit/
    store.ts        MemoryStore + (re-export of) RateLimitStore types
    strategies.ts   fixedWindow / slidingWindow / tokenBucket factories
    config.ts       set/getRateLimitConfig (module-level holder)
    enforce.ts      resolve precedence + consume + set headers + throw
    index.ts        barrel
  types/core/ratelimit.ts   all interfaces above
  decorators.ts             add RateLimit decorator (export)
```

Edited files:

- `utils/core/controller.ts` — call the enforce step within `beforeRequest`.
- `types/core/controller.ts` — add `'rateLimit'` to the item type union/enum/map.
- `core/src/index.ts` — export `RateLimit`, strategies, `MemoryStore`,
  `setRateLimitConfig`, and the public types.
- `types/core/index.ts` — re-export ratelimit types.

## Error handling

- Strategy/store exceptions inside `consume` propagate as normal errors → 500 via
  the existing handler chain. (Fail-closed; a fail-open option is out of scope for
  this slice.)
- Invalid options (`max <= 0`, `windowMs <= 0`) throw a `TypeError` at decoration
  time, matching the `Controller`/guard validation style (`Controller.ts:57`).
- `onLimit` rejections are awaited; a throwing `onLimit` surfaces before the 429
  and is treated as a normal error (documented).

## Testing

Unit tests (vitest, alongside existing `*.spec.ts`):

- **MemoryStore**: increments, `remaining` clamping, `resetAt`, lazy expiry after
  window, `reset()`.
- **fixedWindow**: allows up to `max`, blocks `max+1`, resets after `windowMs`.
- **slidingWindow**: weighted count blocks boundary bursts a fixed window allows.
- **tokenBucket**: burst up to capacity, refill over time at `refillRate`,
  `cost > 1` consumes multiple tokens.
- **Precedence**: method overrides controller overrides global; global-only path;
  no-config path (no headers, no limiting).
- **Headers**: `X-RateLimit-*` present on allowed responses; `Retry-After` +
  429 on breach.
- **Custom store**: a fake `RateLimitStore` is driven by a built-in strategy.
- **Custom strategy**: a fake `RateLimitStrategy` is invoked with the expected
  key/ctx.
- **onLimit**: fired exactly once on breach with `(req, res)`.
- **keyGen**: custom key isolates buckets; default falls back to fingerprint.
```
