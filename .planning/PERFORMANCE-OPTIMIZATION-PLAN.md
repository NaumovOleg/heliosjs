# HeliosJS Performance Optimization Plan

## Goal

Close the performance gap with Fastify. Current benchmark: Helios ~72k req/s vs Fastify ~101k req/s (~40% gap). Target: match or exceed Express, reach ~90k+ req/s.

## Current Hot Path (per request)

```
HTTP request
  → RequestFactory.create()        // URL×2, body buffer, parse, cookie, query
  → Helios.requestHandler()        // plugin hook, CORS
  → Helios.beforeRequest()         // middleware chain (recursive async)
  → matchRoutes()                  // linear scan, split/filter per route, regex compile
  → execute()                      // param resolution, guards, pipes, handler
  → Res.end()                      // JSON.stringify
  → sendResponse()                 // headers, X-Response-Time
```

## Phase 1 — Quick Wins (low complexity, high impact)

### 1.1 Pre-compile route regex + cache in Route

**File**: `src/core/src/utils/core/match.ts`

**Problem**: Line 33 — `new RegExp('^' + regexPattern + '$')` compiles regex on every request for every param-with-regex route.

**Fix**: Add `compiledRegex?: RegExp` to `Route` type. Compile once in `collectRoutes()` (`controller.ts:309-341`). Use cached regex in `extractParamsAndWildcard()`.

```
Route type: add compiledRegex: RegExp | null
collectRoutes(): compile regex here
extractParamsAndWildcard(): use route.compiledRegex instead of new RegExp()
```

**Files to change**:

- `src/core/src/types/core/index.ts` — add field to Route
- `src/core/src/utils/core/controller.ts:309-341` — compile in collectRoutes
- `src/core/src/utils/core/match.ts:27-36` — use cached regex

### 1.2 Lazy body parsing — skip for GET/HEAD

**File**: `src/http/src/utils/http/request.factory.ts`

**Problem**: Line 31 — `collectRawBody(req, maxBytes)` runs for ALL methods including GET/HEAD which have no body.

**Fix**: Check `req.method` before calling `collectRawBody()`. Skip for GET, HEAD, OPTIONS.

```
if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
  rawBody = await collectRawBody(req, maxBytes);
}
```

**Files to change**:

- `src/http/src/utils/http/request.factory.ts:15-62`

### 1.3 Eliminate double `new URL()`

**File**: `src/http/src/utils/http/request.factory.ts` + `src/core/src/utils/core/request.ts`

**Problem**: `new URL(fullUrl)` at request.factory.ts:21, then `new URL(options.path, ...)` at request.ts:35. Two URL objects per request.

**Fix**: Pass the already-parsed `requestUrl` from factory into Req constructor. Remove the second `new URL()` in Req constructor. Add `requestUrl` to `RequestOptions` type.

**Files to change**:

- `src/core/src/types/core/request.ts` — add requestUrl to RequestOptions
- `src/core/src/utils/core/request.ts:35` — use options.requestUrl if provided
- `src/http/src/utils/http/request.factory.ts:41-61` — pass requestUrl

### 1.4 Pre-partition middleware lists at startup

**File**: `src/core/src/utils/core/helper.ts` + `src/core/src/utils/core/controller.ts`

**Problem**: `extractMiddlewares()` (helper.ts:87-97) does 3 array passes (filter+map+filter) and is called multiple times per request.

**Fix**: In `collectRoutes()`, pre-partition `route.functions` into typed buckets:

```typescript
interface CompiledRoute {
  sanitizers: Sanitizer[];
  guards: Guard[];
  pipes: Pipe[];
  middlewares: MiddlewareCB[];
  interceptors: InterceptorCB[];
  errorHandlers: ErrorHandler[];
  cors: CorsConfig[];
}
```

Build this once in `collectRoutes()`. Use these directly in `execute()` and `beforeRequest()`.

**Files to change**:

- `src/core/src/types/core/index.ts` — add CompiledRoute type
- `src/core/src/utils/core/controller.ts:309-341` — build buckets
- `src/core/src/utils/core/controller.ts:24-182` — use buckets
- `src/core/src/utils/core/controller.ts:255-307` — use buckets

---

## Phase 2 — Pipeline Restructuring (medium complexity)

### 2.1 Flat middleware chain — for-loop instead of recursion

**File**: `src/http/src/Helios.ts:282-320`

**Problem**: Recursive async closures with N `await` suspension points per N middlewares.

**Fix**: Replace recursive `runMiddlewares()` with flat for-loop:

```typescript
for (const mw of this.middlewares) {
  await mw(request, response, NextFunction);
}
// then global middlewares
for (const mw of this.globalMiddlewares) {
  await mw(request, response, NextFunction);
}
```

No closures created per invocation. JS engine can optimize better.

**Files to change**:

- `src/http/src/Helios.ts:282-320` — rewrite beforeRequest

### 2.2 Cache guard instances

**File**: `src/core/src/utils/core/controller.ts:232-233`

**Problem**: `new guard()` creates a new instance on every request for class-based guards.

**Fix**: Cache guard instances in a WeakMap or Map at route compilation time:

```typescript
const guardCache = new WeakMap<GuardClass, GuardInstance>();
// in runGuard():
let instance = guardCache.get(guard);
if (!instance) {
  instance = new guard();
  guardCache.set(guard, instance);
}
```

**Files to change**:

- `src/core/src/utils/core/controller.ts:217-253`

### 2.3 Pre-compiled param resolver

**File**: `src/core/src/utils/core/controller.ts:60-108`

**Problem**: For each request, iterates `totalParams` and does `route.parameters.find(p => p.index === i)` — O(params²) overall.

**Fix**: In `collectRoutes()`, build a pre-compiled param resolver function per route:

```typescript
// at compile time
route.resolveArgs = (request, response, body, multipart) => {
  const args = new Array(route.paramCount);
  args[0] = request; // or whatever the param mapping is
  args[1] = response;
  // ... pre-computed, no find() needed
  return args;
};
```

**Files to change**:

- `src/core/src/types/core/index.ts` — add resolveArgs to Route
- `src/core/src/utils/core/controller.ts:309-341` — build resolver
- `src/core/src/utils/core/controller.ts:60-108` — use resolver

---

## Phase 3 — Architecture Changes (high complexity)

### 3.1 Schema-based JSON serialization

**New dependency**: `fast-json-stringify`

**New decorator**: `@ResponseSchema(schema)` on controller methods.

**Flow**:

1. At route compilation, read `@ResponseSchema` metadata → compile serializer via `fast-json-stringify`
2. Store compiled serializer in Route object
3. In `Res.end()`, if serializer exists, use it instead of `JSON.stringify`

**Expected gain**: 10-20% throughput for JSON responses.

**Files to change**:

- `src/core/src/decorators.ts` — add ResponseSchema decorator
- `src/core/src/types/core/index.ts` — add serializer to Route
- `src/core/src/utils/core/response.ts:257-266` — use serializer
- `src/http/package.json` — add fast-json-stringify dep

### 3.2 Radix tree router

**New dependency**: `find-my-way`

**Replace**: `matchRoutes()` linear scan → find-my-way radix tree.

**Flow**:

1. At controller compilation, register routes in find-my-way instance
2. On request, `router.lookup(req)` — O(path-length) regardless of route count
3. find-my-way returns matched params directly

**Expected gain**: 20-40% for apps with many routes. Minimal for <10 routes.

**Files to change**:

- `src/core/src/utils/core/match.ts` — replace with find-my-way wrapper
- `src/core/src/utils/core/controller.ts:309-341` — register in trie
- `src/core/package.json` — add find-my-way dep

---

## Execution Order

```
Phase 1 (all independent, can be done in parallel):
  1.1 Pre-compile regex
  1.2 Lazy body
  1.3 Single URL
  1.4 Pre-partition middleware
  → benchmark after each

Phase 2 (sequential, depends on Phase 1.4):
  2.1 Flat middleware chain
  2.2 Cache guards
  2.3 Pre-compiled params
  → benchmark after each

Phase 3 (independent of Phase 1-2):
  3.1 Schema serialization
  3.2 Radix tree
  → benchmark after each
```

## Benchmark Protocol

After each optimization:

1. `yarn build` — rebuild packages
2. `yarn benchmark` — run full benchmark suite
3. Record: req/s, latency avg/max, throughput
4. Compare with baseline (Helios ~72k, Express ~67k, Fastify ~101k)
5. Commit with benchmark results in commit message

## Success Criteria

- [ ] Phase 1 complete: Helios ≥ 85k req/s (+18%)
- [ ] Phase 2 complete: Helios ≥ 92k req/s (+28%)
- [ ] Phase 3 complete: Helios ≥ 95k req/s (+32%)
- [ ] No regressions in existing tests (`yarn test`)
- [ ] Lint passes (`yarn lint`)
