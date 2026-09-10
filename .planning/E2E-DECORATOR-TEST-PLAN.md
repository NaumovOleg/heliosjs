# Plan: Exhaustive E2E tests for routing + middleware decorators

Status: IN PROGRESS · Owner: — · Created 2026-09-10

## Progress (2026-09-10)

Shared harness + 11 new e2e files landed, 1 broken/duplicated file deleted,
3 misleading assertions in `http-deep-pipeline.test.ts` fixed.
`yarn test`: 1479 pass, 6 expected-fail (documented bugs), 0 unexpected.
`yarn build`: green.

| File | Tests | Notes |
|---|---|---|
| `__tests__/helpers/e2e.ts` | — | `startE2E()` — real `http.Server` on `:0`, working `close()` |
| `http/e2e/routing-methods.e2e.test.ts` | 10 | verbs, @Any, @Endpoint(ANY), 404 on mismatch, @Query body |
| `http/e2e/routing-matching.e2e.test.ts` | 14 | specificity ladder, first-declared tie, child-vs-parent-wildcard, param extraction per kind |
| `http/e2e/params-extraction.e2e.test.ts` | 10 | all param decorators, index gaps, no-decorator handler, mixed |
| `http/e2e/params-validation.e2e.test.ts` | 9 | DTO validation body/query/params (+headers/cookies via it.fails), from(), no-DTO |
| `http/e2e/sub-controllers.e2e.test.ts` | 7 | 3-level nesting, mw inheritance order, ancestor guard, sibling isolation, `static controllers` gap |
| `middlewares/e2e/ordering.e2e.test.ts` | 12 | phase order + stability, controller-vs-method, interceptor/@Catch reverse, sanitize/pipe placement |
| `middlewares/e2e/guard.e2e.test.ts` | 16 | fn/class/instance, bool/string/async, multi-guard, @Roles ANY/ALL/missing-extractor |
| `middlewares/e2e/pipe-sanitize.e2e.test.ts` | 9 | pipe body/query/params/headers, pipe-feeds-validation, joi sanitize, stripUnknown |
| `middlewares/e2e/intercept-catch-status.e2e.test.ts` | 26 | falsy returns, throw paths, SKIP_ERROR_HANDLER_CODES matrix, @Status precedence, redirect |
| `middlewares/e2e/cors-ratelimit.e2e.test.ts` | 10 | @Cors echo/reject/AND-combine, preflight, @RateLimit enforce/headers/per-fingerprint/method-override |
| `middlewares/e2e/fingerprint.e2e.test.ts` | 5 | @Fingerprint determinism, @UseFingerprint({components}) scope narrowing, @Server fingerprint components/secret, compute-once caching |
| `http/e2e/multipart.e2e.test.ts` | 4 | @Files() all + @Files(name), multi-file array, text-only form (+ note: fields go through JSON.parse) |
| ~~`middlewares/e2e/middleware-pipeline.test.ts`~~ | -18 | DELETED — fully subsumed by the new files; had a hardcoded-port collision with `helios-coverage.test.ts` (both `portCounter = 20000`) causing intermittent EADDRINUSE under parallel runs |
| `http/e2e/http-deep-pipeline.test.ts` | ±0 | fixed 3 misleading tests: "returns 204" asserted 200 (renamed + asserts the object body); "throws and returns non-Error recovery" (renamed to "uncaught throw → 500"); "sub-controller routes are accessible" used `static controllers` and never hit the child route (switched to config form, now asserts the child route) |

### Bugs found (assertion written to spec, marked `it.fails`)

| id | test | spec | actual |
|---|---|---|---|
| B1 | routing-matching › `regex-constrained :param(\\d+) is readable by its name` | `@Params('id')` on `/:id(\d+)` = matched segment | `buildParamExtractor` keys it `id(\d+)`; `@Params('id')` → `undefined` |
| B3 | routing-methods › `HEAD falls back to a GET handler` | HEAD served by matching GET route (Express/Fastify parity) | `isMethodMatch` is exact-verb/ANY only → 404 |
| B12 | ordering › `route-array middlewares run in the array order given` | `@Get('/', [a, b])` runs `a` then `b` | `collectRoutes` does `functions.unshift(...routeMiddlewares.reverse())` → `b` then `a` |
| B13 | params-extraction › `@Headers(name) is case-insensitive` | `@Headers('X-Token')` resolves wire header `x-token` | verbatim key lookup on the lower-cased map → `undefined` |
| B14 | params-validation › `@Headers(Dto)` / `@Cookies(Dto)` | CLAUDE.md + `TO_VALIDATE` promise DTO validation for headers/cookies/multipart | `@Headers`/`@Cookies`/`@Files` are typed `(name?: string)` — a class lands in `param.options`, never `param.dto`; nothing validates |

Non-bug findings recorded as passing tests / comments:
- cross-kind decorator order is phase-fixed, not source-order (by design — pinned).
- multiple root controllers are NOT specificity-arbitrated; first root with any match wins (only within one controller's tree is specificity compared).
- `@Cors` decorator preflight requires an `@Options`/`@Any` route to match (OPTIONS won't hit a `@Get` route); server-level `@Server({cors})` handles preflight pre-routing.
- `@Cors` at method + controller AND-combine (stricter wins) — surprising if you expect "method opens CORS", but consistent.
- Ok204 body is correctly empty over the wire (B8 not a bug — Node strips it).
- Optional `:param?` — present-segment value IS readable (the `?` is stripped by `normalizePath`'s query-split); absent-segment yields no params (fine).
- mid-route wildcard `/a/*/c` (B4): the route *matches* but the captured segment is unavailable — `compileRouteRegex` emits a non-capturing `.*` for a non-trailing `*`. Trailing `*` is the supported form. Recorded as a passing test with a note, not a bug.
- multipart text fields are run through `JSON.parse`, so `count=5` arrives as a number while `title=hi` stays a string. Documented, not asserted as a defect.

### Remaining / not yet done

- The other `http-*-pipeline.test.ts` files still copy-paste `buildApp`/`startApp` (3× now) with the `(app as any).config.controllers = …` reassignment hack and hardcoded port ranges (19000/23000/24000). They pass and don't collide; migrating them to `startE2E` is cleanup, not correctness — deferred.
- Decide: keep bugs as `it.fails` (current) or split into a tracked red list.

---


## Goal

Every routing/middleware decorator in `@heliosjs/core` and `@heliosjs/middlewares`
exercised end-to-end (real `node:http` server + `fetch`), across all documented
input shapes and combinations, with **assertions written against the spec, not
against current output**. A failing test = a bug report, never a reason to edit
the test.

## Principles (non-negotiable)

1. Assert the *correct* behavior derived from JSDoc + `CLAUDE.md` + HTTP semantics.
   If the framework disagrees, the test fails and the failure is documented in the
   "Bugs found" table — code is not touched in this effort.
2. Prefer E2E (`buildApp` + `startApp` + `fetch`). Drop to `execute()`-level only
   for branches unreachable via HTTP (uncompiled-route fallback).
3. One behavior per `it`. Name states the rule, not the mechanism.
4. Ordering tests use a shared `calls: string[]` log and assert the whole array.
5. No `vi.useFakeTimers` in E2E; rate-limit tests use tiny real `windowMs`.
6. Each new file is committed atomically (`test(e2e): …`).

## Current state (assessment)

| Area | Existing coverage | Verdict |
|---|---|---|
| `@Get/@Post/@Put/@Patch/@Delete/@Options/@Head/@Query/@Any/@Endpoint` | metadata unit tests + happy-path e2e in `http-full-pipeline` | **method dispatch OK, no negative/precedence cases** |
| Route matching / `routeSpecificity` | `remaining-gaps.test.ts` at `matchRoutes()` level only | **no e2e; specificity ladder untested through HTTP** |
| Param decorators (`@Body/@Params/@QueryParam/@Headers/@Cookies/@Files/@Req/@Res/@Fingerprint`) | "decorator sets metadata" unit tests; shallow e2e for Body/Params/QueryParam/Req/Res/Headers | **no DTO validation e2e, no name-selector e2e for cookies/files, no index-gap, no QUERY-body** |
| `@Use` | `middleware-pipeline` e2e: method, controller, multi, order | decent; **missing: global vs controller vs method precedence, array form e2e, cross-kind order** |
| `@Guard` | fn guard + class guard e2e | **missing: instance guard, string-return message, async, `.message` prop, multiple guards, controller+method** |
| `@Pipe` | body transform e2e | **missing: query/params/headers transforms, pipe output feeds validation, order vs guard** |
| `@Intercept` | single wrap + undefined-return e2e | **missing: multiple interceptors reverse order, controller+method, async, throw inside** |
| `@Catch` | single handler, middleware-error, custom-code e2e | **missing: multiple `@Catch` chaining, re-throw, SKIP_ERROR_HANDLER_CODES with vs without @Catch, handler order** |
| `@Status` / `Ok200/201/204` | method + class-level e2e | **missing: method-overrides-class, redirect bypasses status, 204 body suppression** |
| `@Cors` (decorator, not server config) | metadata unit only | **zero e2e — method vs controller vs server merge, preflight, credentials** |
| `@RateLimit` | `ratelimit-integration.test.ts` + enforce unit | **no decorator-level e2e; method-overrides-controller-overrides-global untested through HTTP** |
| `@Sanitize` | metadata unit + `sanitize.ts` unit | **zero e2e; runs-before-guards ordering untested** |
| `@Roles` (RBAC) | `middlewares/roles.test.ts` unit | **zero e2e; extractor wiring via `@Server({rbac})`, any/all mode, missing-extractor error** |
| `@UseFingerprint` / `@Fingerprint()` | fingerprint unit tests | **no e2e** |
| Sub-controllers | `http-deep-pipeline`: 1-level, happy path | **missing: 3-level nesting, middleware inheritance grandparent→child, `config.controllers` vs `static controllers`, prefix join edge cases** |
| Full pipeline ordering (the 11 steps in CLAUDE.md) | scattered, partial | **no single test that pins CORS→rateLimit→sanitize→guard→pipe→middleware→handler→interceptor→errorHandler** |

**Weak existing tests to rewrite, not extend:**

- `http-full-pipeline.test.ts` "OPTIONS returns 204" / "returns 204 No Content"
  assert only `res.status`; should also assert body + CORS headers.
- `http-deep-pipeline.test.ts` "returns 204 No Content for empty response"
  actually expects `200` — the name lies. Rewrite to the real rule.
- `http-plugins-pipeline.test.ts` middleware-order tests overlap
  `middleware-pipeline.test.ts`; consolidate global-middleware ordering in one place.
- `middleware-pipeline.test.ts` `import { vi }` unused; `@Ok204` test returns
  `null` but doesn't assert the body is actually empty over the wire.
- Every `__tests__/core/unit/decorators/*` file only checks `Reflect.getMetadata`
  shape. Keep them (fast regression on metadata) but they are **not** behavior
  coverage — the plan's e2e files own behavior.

## New test files

| File | Owns |
|---|---|
| `__tests__/http/e2e/routing-methods.e2e.test.ts` | HTTP method dispatch: each verb, `@Any`/`@Endpoint(ANY)`, method mismatch → 404, HEAD-without-@Head, case, `@Query` body semantics |
| `__tests__/http/e2e/routing-matching.e2e.test.ts` | `routeSpecificity` ladder through HTTP: static > `:p(regex)` > `:p` > `:p?` > `*`; first-declared tie; cross-controller/child match; trailing slash; encoded segments; `:p(regex)` param extraction; optional-segment param extraction; trailing/mid wildcard capture |
| `__tests__/http/e2e/params-extraction.e2e.test.ts` | `@Params/@QueryParam/@Headers/@Cookies/@Files/@Req/@Res/@Fingerprint`: no-arg, name selector, DTO, DTO+name, DTO+options; index gaps → `undefined`; zero param decorators → `(req,res)`; header case; cookie parsing; multipart field vs file |
| `__tests__/http/e2e/params-validation.e2e.test.ts` | DTO validation for all 6 `TO_VALIDATE` sources (body/query/params/headers/cookies/multipart) with class-validator; joi; `dto.from()` static; ctor-arity>0 path; validation failure → 400 + error body shape; `whitelist`/`forbidNonWhitelisted` options |
| `__tests__/middlewares/e2e/ordering.e2e.test.ts` | **The ordering spec.** Full 11-step pipeline pin; cross-kind fixed phases; controller vs method vs global within a kind; interceptor reverse order; errorHandler reverse order; route-array middleware vs `@Use` |
| `__tests__/middlewares/e2e/guard.e2e.test.ts` | `@Guard` fn / class / instance; boolean / string-message / async; `.message` property; multiple guards (all must pass, first failure wins); controller+method; guard throws non-Forbidden; `@Roles` any/all/missing-extractor |
| `__tests__/middlewares/e2e/pipe-sanitize.e2e.test.ts` | `@Pipe` body/query/params/headers; pipe result is what the handler + validation see; `@Sanitize` single/array config; sanitize runs before guard; pipe after guard |
| `__tests__/middlewares/e2e/intercept-catch-status.e2e.test.ts` | `@Intercept` single/multiple/nested/async/throwing; `@Catch` single/multiple/re-throw/return-shape; SKIP_ERROR_HANDLER_CODES matrix; `@Status` + `Ok2xx` precedence; redirect bypass |
| `__tests__/middlewares/e2e/cors-ratelimit.e2e.test.ts` | `@Cors` decorator: method/controller/server merge, preflight 204, disallowed origin 403, `optionsSuccessStatus`, credentials/headers/methods echo; `@RateLimit` decorator: enforcement, `max`/`windowMs`, method>controller>global precedence, key = fingerprint, 429 body + headers |
| `__tests__/http/e2e/sub-controllers.e2e.test.ts` | 3-level nesting; prefix join (`/`, trailing, `//`); middleware inheritance grandparent→parent→child (order); `config.controllers` array vs `static controllers`; sibling isolation; child route beats parent wildcard |

Naming uses `.e2e.test.ts` to distinguish from the existing flat `*.test.ts`;
confirm `vitest.config.ts` `include` glob picks them up (it globs `__tests__/**/*.test.ts`).

## Case matrix — routing decorators

### `@Endpoint` / verb shortcuts
- Each of GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD/QUERY dispatches to its handler.
- `@Endpoint('get', …)` lowercase → uppercased (already unit-tested; add e2e).
- Wrong method on an existing path → **404** (not 405 — framework has no 405 path;
  assert current contract and note if 405 is the intent).
- Two handlers, same path, different verbs → each verb hits its own handler.
- `@Any()` (== `@Endpoint(ANY,'*')`) catches every verb; a sibling explicit verb
  route on a more specific path still wins (specificity: `*` is rank 0).
- `@Endpoint(ANY,'/x')` vs `@Get('/x')` on same path → GET request: **first
  declared wins** on tie? No — both rank identically (`x`→"45"), tie → first
  declared. Test declaration order both ways.
- `@Query('/search')` with `@Body()` reads the **request body**, not querystring
  (per Endpoint.ts JSDoc). `@QueryParam()` on a `@Query` route → from body too.
- HEAD request to a `@Get('/')`-only controller → document result (likely 404;
  Express/Fastify auto-map HEAD→GET, Helios `isMethodMatch` does not). **Bug candidate.**

### Route patterns / `routeSpecificity`
Build one controller with overlapping routes, hit paths, assert which handler ran:

| Routes present | Request | Expected handler |
|---|---|---|
| `/users`, `/*` | `/users` | `/users` |
| `/users/:id`, `/users/*` | `/users/5` | `/users/:id` |
| `/users/:id`, `/users/me` | `/users/me` | `/users/me` (static > param) |
| `/users/:id(\\d+)`, `/users/:id` | `/users/5` | regex variant |
| `/users/:id(\\d+)`, `/users/:id` | `/users/abc` | plain `:id` |
| `/a`, `/a/:x?` | `/a` | `/a` (trailing-marker rule) |
| `/a`, `/a/*` | `/a` | `/a` |
| `/files/:name?` | `/files` and `/files/x` | same handler, `name` = `undefined` / `'x'` |
| `/p/:a`, `/p/:b` (dup shape) | `/p/1` | first declared |
| child ctrl `/api` → `/users/:id`, parent `/api/*` | `/api/users/5` | child route |

Param-extraction correctness at handler time (this is `buildParamExtractor`, which
diverges from `match.ts`):
- `/users/:id(\\d+)` + `@Params('id')` → handler must receive `'5'`.
  **Bug candidate**: `buildParamExtractor` stores the key as `id(\\d+)`, not `id`.
- `/download/:file?` + `@Params('file')` → `'x'` for `/download/x`, `undefined`
  for `/download`. **Bug candidate**: `buildParamExtractor` requires exact segment
  count and treats `file?` literally.
- `/assets/*` + `@Params('*')` → `'css/app.css'` for `/assets/css/app.css`.
- `/a/*/c` (mid-route wildcard) → document behavior (regex `.*` is greedy;
  `buildParamExtractor` only handles trailing `*`). **Bug candidate.**
- Trailing slash: `/users/` hits `/users`. Encoded slash `%2F` in a segment.
- `normalizePath` collapses `//`; `/users//5` → `id='5'`.

### `@Controller`
- String form vs `{ prefix }` form → same routing.
- `{ prefix, middlewares, controllers }` — all three honored.
- No prefix → defaults to `/`; `@Controller('/')` + `@Get('/')` serves `/`.
- Prefix without leading slash, with trailing slash, with `//` → normalized.
- `@Controller` second-arg middlewares run for all routes, before method `@Use`.
- Invalid prefix / sub-controllers / middlewares → `TypeError` at decoration
  (already unit-tested; keep).
- Two root controllers, overlapping prefixes → both reachable, no cross-talk.

## Case matrix — middleware decorators + ORDERING

### The pipeline order (encode verbatim from `CLAUDE.md` "Request pipeline")
One test with a controller that declares **one of every kind** at method level and
a `calls[]` log, plus server-level CORS + rate limit + sanitizer + global `@Use`.
Assert the exact sequence:

```
matchRoute → serverCORS → serverRateLimit(n/a here) → staticMw → configMw
 → globalMw(app.use) → pluginBeforeRoute
 → [route] rateLimit → cors → sanitizer → guard → pipe → middleware(@Use)
 → paramResolve(+validate) → handler
 → interceptor(reverse) → (errorHandler on throw)
```

Sub-assertions (each its own `it`):
- **Cross-kind is phase-fixed, not declaration-order.** `@Use(mw)` written
  *above* `@Guard(g)` still runs *after* the guard (buckets in
  `buildCompiledMiddleware`). Test both stacking orders → same result.
- **Within a kind, controller before method.** `@Use` on class + `@Use` on method
  → class mw first. Same for guards, pipes, interceptors (interceptor: class runs
  *after* method because of reverse iteration — assert that explicitly).
- **Global (`app.use`) before any controller/route middleware.**
- **`@Get('/x', [a, b])` route-array middlewares run before method `@Use`, in
  array order.**
- **Multiple `@Use` = reading order** (`first`, `second`) — matches existing test;
  keep one canonical copy.
- **Sanitizers run before guards** (so a guard sees sanitized input).
- **Pipes run after guards, before validation** (pipe output gets validated).

### `@Use`
- Single fn / array / method / controller / global — each reaches the handler.
- Middleware that never calls `next()` → handler still runs (pipeline doesn't gate
  on `next` in compiled path — assert real behavior; **bug candidate** if a
  short-circuit was intended).
- Middleware calls `next(err)` → routed to `@Catch` if present, else 500.
- Middleware mutates `req.setState` / `req.body` → visible to handler.
- Middleware sets a response header → present on the wire.
- Async middleware awaited before handler.

### `@Guard`
- Function guard: `true` → pass; `false` → 403; `'msg'` → 403 with `msg` in body;
  async variants of each.
- Class guard (`new`-ed per request): boolean / string / async; `message` property
  used when `canActivate` returns `false`.
- Instance guard (object with `canActivate`): same matrix; `guard.message`.
- Multiple guards: all must pass; first failing guard's message wins; later guards
  don't run after a failure.
- Controller guard + method guard → controller first.
- Guard throws a non-`ForbiddenError` → propagates (500 or `@Catch`).
- 403 from guard **skips `@Catch`** unless a `@Catch` is declared (SKIP codes).

### `@Roles` (RBAC)
- `@Server({ rbac: { getRoles } })` wires the extractor; `@Roles('admin')` on a
  route → 403 when extractor returns `[]`, 200 when it returns `['admin']`.
- `@Roles('a','b')` = ANY; `@Roles(['a','b'], { mode: 'all' })` = ALL.
- Custom `message`.
- No extractor configured → `InvalidStateError` → **500** (assert; the decorator
  can't 403 without an extractor).
- Extractor returns a scalar vs array vs `null`.
- `setRolesExtractor` is a core singleton — tests must reset it in `afterEach`
  (note: cross-test pollution risk; add a `resetRolesExtractor` or set to a known
  value per test).

### `@Pipe`
- `{ body }`, `{ query }`, `{ params }`, `{ headers }` each transform the right
  slot; combined object transforms all.
- Handler + DTO validation see the piped value (pipe → then validate).
- Pipe throws → `@Catch` / 500.
- Controller pipe + method pipe → both run, controller first.
- Pipe receives `(value, request)`.

### `@Sanitize`
- Single config / array of configs.
- `trim`, `escape`, `lowercase`, field whitelist (whatever `sanitizeRequest`
  supports — enumerate from `sanitize.ts`).
- Runs before guard (guard sees sanitized value).
- Controller + method configs both apply.

### `@Intercept`
- Single: wraps return value.
- Runs when handler returns `undefined` / `null` / `0` / `''` (falsy) — existing
  test covers `undefined`; add the rest.
- Multiple interceptors: **reverse order**, nearest-handler first. Assert with a
  string-appending interceptor: `@Intercept(A) @Intercept(B) @Get` → `B` sees raw,
  `A` sees B's output.
- Controller interceptor runs after method interceptor (reverse iteration).
- Async interceptor awaited.
- Interceptor throws → `@Catch` / 500; `response.data` not set from a thrown
  interceptor.
- Interceptor does **not** run when handler threw (only error path runs).

### `@Catch`
- Single handler: handler throw → non-Error return becomes body, status 200
  (or the handler-set status).
- Handler returns an `Error` → chain continues to next `@Catch`; all return
  `Error` → 500 with last error.
- Multiple `@Catch`: **reverse order** (`[...errorHandlers].reverse()` in compiled
  path). `@Catch(A) @Catch(B) @Get` → `B` runs first.
- `@Catch` that re-throws → next handler sees the new error.
- Error from **middleware/guard/pipe** (`beforeRequest`) is caught by `@Catch`
  too (existing test covers `@Use` throw; add guard + pipe throw).
- SKIP_ERROR_HANDLER_CODES matrix:
  | thrown | `@Catch` present? | expected |
  |---|---|---|
  | `ForbiddenError` | no | 403, handler not called |
  | `ForbiddenError` | yes | handler called, its return shapes body |
  | `NotFoundError` | no / yes | 404 / handler |
  | `RateLimitExceededError` | no / yes | 429 / handler |
  | `UnauthorizedError` | no / yes | 401 / handler |
  | generic `Error` | no | 500 |
  | generic `Error` | yes | handler |
- Controller `@Catch` catches errors from all its routes.

### `@Status` / `Ok200` / `Ok201` / `Ok204`
- Method-level sets status on success.
- Class-level sets default for all routes (existing test).
- **Method overrides class** (`compiled.status` last-wins in `allFunctions`
  order → method is later). Assert.
- `Ok204` → status 204 **and empty body over the wire** (existing test only
  checks status).
- Handler that calls `res.redirect(...)` / sets `isRedirect` → `@Status` ignored,
  3xx kept.
- Handler returns an `Error` → `@Status` ignored, error status wins.
- `@Status` value coexists with `@Intercept` (status set before interceptors run).

### `@Cors` (decorator — distinct from `@Server({cors})`)
- Method-level `@Cors({ origin })`: allowed origin → `access-control-allow-origin`
  echoed; disallowed → 403.
- Controller-level `@Cors()` (defaults: `origin:'*'`, `optionsSuccessStatus:204`,
  all methods) applies to every route.
- Multiple CORS configs (server + controller + method) → **AND** of `permitted`
  and `continue` (`execute` reduces them). Test a combo where server allows but
  method denies → 403.
- Preflight `OPTIONS` with `Access-Control-Request-Method` → `optionsSuccessStatus`
  (default 204), no handler invocation, `allow-methods` / `allow-headers` echoed.
- `credentials: true` → `access-control-allow-credentials: true` and origin not `*`.

### `@RateLimit`
- `@RateLimit({ max: 2, windowMs: 1000 })` on a route: 3rd request within the
  window → 429; after the window → allowed again.
- `max` / `windowMs` non-positive → `TypeError` at decoration time (unit-level,
  keep in `ratelimit.test.ts`).
- Precedence: global (`setRateLimitConfig`) < controller `@RateLimit` <
  method `@RateLimit` — method wins. Test all three layered.
- Key defaults to fingerprint → two "clients" (different `User-Agent`) counted
  separately.
- 429 response: status + `retry-after` / `x-ratelimit-*` headers (enumerate from
  `enforceRateLimit`), and skips `@Catch` unless declared.
- Custom `strategy` (sliding window) plugs in.

### `@Fingerprint()` / `@UseFingerprint()`
- `@Fingerprint()` param → stable string for identical request, differs when
  `User-Agent` / `Accept-Language` differ.
- Works without `@UseFingerprint()` (lazy compute in `execute`).
- `@UseFingerprint({ components })` overrides the component set for that scope.
- `@Server({ fingerprint })` config respected.

## Sub-controllers

- 3 levels: `/api` → `/api/v1` → `/api/v1/users` — leaf route reachable at the
  fully-joined path.
- Grandparent `@Use(gp)` + parent `@Use(p)` + child `@Use(c)` → order
  `gp, p, c, handler` (parent functions prepended at each level).
- Grandparent `@Guard` blocks a child route.
- `config.controllers: [Child]` vs `static controllers = [Child]` → both work
  identically.
- Sibling children isolated: middleware on child A doesn't touch child B.
- Child static route beats a parent `/*` (depth-first walk keeps best specificity
  across the whole tree).
- Prefix join: parent `/api/`, child `/users` → `/api/users` (no `//`).
- Empty parent prefix `/` + child `/x` → `/x`.

## Suspected bugs to target (write the test to the SPEC; let it fail)

| # | Where | Expected (spec) | Suspected actual |
|---|---|---|---|
| B1 | `buildParamExtractor` (`helper.ts`) | `:id(\\d+)` route → `@Params('id')` = matched segment | key stored as `id(\\d+)`; `@Params('id')` → `undefined` |
| B2 | `buildParamExtractor` | `/x/:opt?` → `@Params('opt')` = segment or `undefined`; route `/x` still serves | exact-segment-count check + literal `opt?` key → params dropped |
| B3 | `isMethodMatch` (`match.ts`) | `HEAD /x` falls back to `@Get('/x')` (common framework behavior) | only exact verb or `ANY` → 404 |
| B4 | mid-route wildcard `/a/*/c` | either documented-unsupported or captured correctly | regex greedy `.*` mismatch vs param extractor |
| B5 | string handler return | `content-type: text/plain` | `application/json` (TEST-COVERAGE-PLAN bug #10) |
| B6 | global `app.use` `try { await next() } catch` | can observe handler error | error swallowed by pipeline (bug #12) |
| B7 | `@Use` middleware without `next()` in compiled path | short-circuits (no handler) OR documented no-op | handler runs anyway |
| B8 | `@Ok204` / empty return | 204 + **zero-length body** | body may carry `null`/`{}` |
| B9 | `@Roles` singleton (`setRolesExtractor`) | isolated per app instance | process-global; leaks across tests/apps |
| B10 | cross-kind decorator order | if a user expects `@Use` above `@Guard` to run first, it doesn't | phase buckets override author order (document as designed OR bug) |
| B11 | `@Cors` method-deny vs server-allow | most-specific wins OR AND semantics documented | `execute` ANDs them — surprising for "method opens up CORS" use case |

Confirm/deny each by reading source before filing; the table is a hunting list,
not a verdict.

## Execution phases

1. **Scaffold + shared helper** — extract `buildApp`/`startApp`/`makePort` (now
   copy-pasted in 5 files) into `__tests__/helpers/e2e.ts`; port allocation that
   can't collide (the current code calls `makePort()` twice per app and ignores
   the `@Server` port). Commit.
2. **routing-methods + routing-matching** e2e. Commit each.
3. **params-extraction + params-validation** e2e. Commit each.
4. **ordering.e2e** — the pipeline spec. Commit.
5. **guard / pipe-sanitize / intercept-catch-status / cors-ratelimit** e2e.
   Commit each.
6. **sub-controllers** e2e. Commit.
7. **Rewrite the weak existing tests** listed above; delete the duplicated
   global-middleware-order cases. Commit.
8. **Bugs-found report** — append a table to this file (mirror
   `TEST-COVERAGE-PLAN.md` format): file:line of the failing assertion, spec ref,
   suspected root cause. Mark newly-failing tests with `it.fails(...)` **only**
   if the suite must stay green for CI — otherwise leave them red and list them.
9. Run `yarn test` + `yarn build` as gates (per project memory: `yarn lint` /
   `yarn test:coverage` are broken on master, don't gate on them). Report the
   coverage delta from `yarn test:coverage` as information only.

## Open questions

- Keep failing bug-tests red, or `it.fails()` + tracked list? (default: red, since
  the whole point is a bug net — but confirm CI tolerance).
- Is HEAD→GET fallback (B3) intended? affects whether it's a "bug" or a "feature
  request" test.
- `.e2e.test.ts` suffix vs existing flat naming — match `vitest` include glob.
