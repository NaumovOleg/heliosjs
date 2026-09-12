# Codebase Concerns

**Analysis Date:** 2026-09-10

> Refreshed from the 2026-09-03 version. Verified against a clean `master` at commit
> `20b5099` (`fix(middlewares)`): `yarn test` passes (94 files, 1368 tests, ~3s),
> `yarn build` passes, `yarn lint` and `yarn test:coverage` both fail (details below).
> The working-tree changes referenced in the original task were committed as `20b5099`;
> the tree is otherwise clean apart from parallel edits to `.planning/codebase/*.md`.

## Tooling State (verify gates before trusting them)

**`yarn lint` fails — do not use as a gate:**
- Result: 237 errors, 16 warnings. `eslint --fix` also **mutates unrelated files**
  (observed: `helios-docs/src/components/HomepageFeatures/index.tsx`, `type` -> `interface`).
- Breakdown: ~99 errors are spurious `Parsing error: ... was not found by the project
  service` on files outside the type-aware tsconfig — every `__tests__/**/*.test.ts`,
  `.opencode/plugins/lint-after-edit.ts`, and generated `helios-docs/.docusaurus/*.js`.
  ESLint's glob shouldn't be walking `.docusaurus/` or `.opencode/` at all.
- ~63 real `@typescript-eslint/no-explicit-any` on decorator `(target: any, ...)`
  signatures in `src/middlewares/src/*.ts`, `src/core/src/decorators.ts`,
  `src/grpc/src/*.ts`, etc. Plus 16 `no-console` (in `src/core/src/utils/core/logger.ts`,
  legitimately disabled inline), 5 `no-require-imports`, 3 `no-useless-escape`.
- Files: `eslint.config.*` at repo root, `src/core/src/tsconfig*.json`.
- Fix approach: scope the ESLint `ignores` to exclude generated/plugin dirs and add
  `__tests__` to a lint tsconfig `include` (or `allowDefaultProject`); then triage the
  `any` decorator signatures with a shared `DecoratorTarget` type.
- Workaround (per project memory): lint only touched files with `npx eslint <files>`
  (no `--fix`), compare against the pre-existing `any` noise.

**`yarn test:coverage` — RESOLVED with real margin, was stale (2026-09-12):**
- The `coverage.exclude` entries for `socket/server.ts`, `socket/socket.ts`,
  `sse/server.ts`, and `src/grpc/src/**` were removed from `vitest.config.ts` entirely
  (not just loosened) and real tests added for the newly-exposed gaps: `logger.ts`
  (67%→100%), `socket/server.ts` (76%→99% stmts), `sse/server.ts` (85%→97% stmts),
  `grpc/module.ts` and `grpc/server.ts` (92%→99% stmts), plus most of `Helios.ts`'s
  lifecycle (listen/close, GraphQL wiring — 83%→90%+ stmts). Current:
  statements 97.6%, branches 90.1%, functions 98.6%, lines 98.1% — all comfortably
  above the 95/88/96/96 thresholds, not razor-thin like before.
- This work also found and fixed 3 real bugs the missing coverage had been hiding
  (see Known Bugs): `@Server({ sanitizers })` silently ignored, nested
  `@Controller({ controllers })` never discovered by the http adapter (so
  `@OnSSE` on a child controller never registered), and `SSEServer.triggerHandlers`
  crashing on a synchronous (non-async) handler.
- Remaining smaller gaps (lower priority, not chased further): a handful of
  `Helios.ts` branches (constructor `log: false`, `close()`'s bind-error path,
  plugin-hook-throws mid-pipeline, static-middleware-ends-response), `aws/lambda.ts`
  branch coverage, `http/utils/http/static.ts`/`request.factory.ts`.

**Gates that DO work:** `yarn test` and `yarn build` (per-package `tsc`). Use these.

## Tech Debt

**`any`-typed decorator signatures throughout:**
- Issue: every decorator factory takes `(target: any, key: string, descriptor: any)`;
  files carry file-level `/* eslint-disable @typescript-eslint/no-explicit-any */`
  (`src/core/src/Controller.ts:1`, `src/core/src/utils/core/helper.ts:1`) or ~40
  inline disables.
- Files: `src/middlewares/src/*.ts`, `src/core/src/decorators.ts`,
  `src/core/src/types/core/controller.ts`, `src/grpc/src/server.ts`,
  `src/grpc/src/client.ts`.
- Impact: no type safety on decorator contracts; the single largest source of lint noise.
- Fix approach: define shared `ClassDecoratorTarget` / `MethodDecoratorTarget` types in
  `src/core/src/types/`, apply across packages.

**CLAUDE.md is stale on vitest exclusions:**
- Issue: `CLAUDE.md` (Layout section) lists `middlewares/e2e/**` as excluded from the
  test run. Commit `20b5099` removed that line from `vitest.config.ts`; those e2e tests
  (`__tests__/middlewares/e2e/middleware-pipeline.test.ts`) now run.
- Files: `CLAUDE.md`, `vitest.config.ts:27-31`.
- Impact: contributors skip a passing test file believing it's disabled.
- Fix approach: update `CLAUDE.md`; current excludes are only
  `grpc/unit/server-extended.test.ts`, `http/unit/factories.test.ts`,
  `core/unit/socket/server.test.ts`.

**`@heliosjs/grpc` doesn't declare `@heliosjs/core` as a dependency:**
- Issue: `src/grpc/src/*` imports `Logger` and types from core but core is not in
  `src/grpc/package.json` deps/peerDeps.
- Files: `src/grpc/package.json`, `src/grpc/src/server.ts`, `src/grpc/src/client.ts`.
- Impact: a standalone `npm i @heliosjs/grpc` can resolve a mismatched or missing core.
- Fix approach: add core as a peer dependency with the matching version range.

**No E2E tests for server lifecycle / Lambda:**
- Issue: `__tests__/http/e2e/*` exercise the request pipeline against a fake socket, not
  a real `http.Server` bind. No test starts/stops `Helios.listen()`/`close()` or drives
  `app.handler` for `@heliosjs/aws` end to end.
- Files: `src/http/src/Helios.ts:206` (`close`), `src/aws/src/lambda.ts`.
- Impact: bind failures, port config, plugin `beforeRequest` ordering, and Lambda event
  normalization regressions surface only on deploy.
- Fix approach: a couple of real-listen tests with an ephemeral port; a Lambda handler
  test per event shape (REST, HTTP API, function URL).

## Known Bugs

**Three metadata-key mismatches silently dropped documented config — FIXED 2026-09-12:**
- All three share one shape: a reader (`Reflect.getMetadata(SOME_KEY, ...)`) pointed at
  a metadata key that nothing in the codebase ever wrote to via `Reflect.defineMetadata`
  — dead code that always returned the default, found only once coverage on the
  containing functions stopped being excluded and a test asserted an actual side effect
  instead of just "didn't throw."
  1. `@Server({ sanitizers: [...] })` was silently ignored — `resolveConfig`
     (`src/http/src/utils/http/server.ts`) read a standalone `SANITIZE` constant instead
     of the resolved config object, unlike `cors`/`controllers`/`middlewares` which
     correctly read from it. Now reads `decoratorConfig.sanitizers`.
  2. `@Controller({ controllers: [Child] })` nested controllers were never discovered by
     `Helios.collectControllers` (`src/http/src/Helios.ts`) — it read a `CONTROLLERS`
     constant (`'app:controllers'`) but `@Controller` actually stores nested controllers
     via `defineControllerMeta` under `DECORATOR.controller`. Practical impact: `@OnSSE`
     handlers on a nested child controller never got registered, since
     `SSEServer.registerControllers` is fed from this same flat list (WS is unaffected —
     it uses a separate `config.websocket.controllers` list). Now uses
     `reflectControllerMeta` from `@heliosjs/core/utils`, the same helper core itself uses.
  3. `SSEServer.triggerHandlers` (`src/core/src/utils/sse/server.ts`) called
     `handler.fn(event).catch(...)`, assuming every `@OnSSE` handler is async. A
     synchronous handler (or one returning a plain value) threw
     `Cannot read properties of undefined (reading 'catch')`, crashing the connection/
     close event dispatch. Now wraps in `Promise.resolve(...)` first, matching the
     equivalent WebSocket code path's `try/catch` and the `Promise.resolve(...)` idiom
     already used for interceptors in `src/core/src/utils/core/controller.ts`.
- Existing tests for #1 and #2 existed but were false positives: they asserted
  `res.status === 200` / array length, or manually wrote metadata under a *different*
  wrong key than the one being tested — none of them actually checked the documented
  behavior occurred. All three now have regression tests asserting the real side effect.
- Changesets: `@heliosjs/http` patch (both http fixes, `fix-server-config-sanitizers.md`
  and `fix-nested-controller-collection.md`), `@heliosjs/core` patch for the SSE fix
  (`fix-sse-sync-handler-crash.md`).

**Route-matching specificity — FIXED in `20b5099`, watch for regressions:**
- Previously: wildcard declared before a specific route always won (specificity sort
  was dead code).
- Now: `routeSpecificity()` in `src/core/src/utils/core/match.ts` builds a per-segment
  rank string (static 4 > `:p(regex)` 3 > `:p` 2 > optional `?` 1 > `*` 0, trailing `5`)
  and `matchRoutes` keeps the highest-ranked match across the whole controller tree,
  ties going to declaration order.
- Files: `src/core/src/utils/core/match.ts`, `src/core/src/utils/core/controller.ts`
  (`collectRoutes` now stores `route.specificity`), `src/core/src/types/core/controller.ts`.
- Tests: `__tests__/core/match.test.ts` (5 cases), `__tests__/core/unit/match-extended.test.ts`.
- Residual risk: the ranking is a string heuristic, not a full trie. Equal-length keys
  are compared lexically, so routes of different segment counts that both match a path
  compare on the trailing `5` only when lengths align — edge cases with mixed optional
  segments and cross-controller children are lightly tested. Add cases before relying on
  deep nesting.

## Security Considerations

**Local `.env` holds a real `NPM_TOKEN`:**
- Risk: token grants npm publish rights for the `@heliosjs/*` scope.
- Files: `.env` (contains `NPM_TOKEN`, `LOG_ERRORS`).
- Current mitigation: `.env` is in `.gitignore:3` and has never been tracked
  (`git log --all -- .env` is empty). The original doc's "committed to VCS" claim does
  not hold.
- Recommendations: still keep the token out of shell history / screenshots; CI publish
  (`.github/workflows/publish.yml`) should use a GitHub secret, not this file. Rotate if
  it was ever pasted into a shared context.

**No systematic input sanitization by default:**
- Risk: request bodies/params reach handlers unsanitized unless a route opts in via
  `@Sanitize`.
- Files: `src/middlewares/src/sanitize.ts`, `src/core/src/utils/core/sanitize.ts`.
- Current mitigation: `@Sanitize` decorator + class-validator/joi validation on
  `body`/`query`/`params`/`headers`/`cookies`/`multipart` when a DTO is supplied.
- Recommendations: document that validation is opt-in per param; consider an app-level
  default sanitizer hook.

**Multipart / body size limits:**
- Risk: unbounded upload memory.
- Files: `src/core/src/utils/core/multipart.ts`, `src/http/src/utils/http/body.ts`,
  `__tests__/http/body-limit.test.ts`, `__tests__/core/payload-too-large.test.ts`.
- Current mitigation: a configurable body limit exists and is tested (413 path).
- Recommendations: confirm the limit is enforced on the multipart stream, not just the
  buffered branch.

## Performance Bottlenecks

**Route matching now scans the whole controller subtree:**
- Problem: `matchRoutes` no longer returns on first regex hit — it evaluates every
  method-matching route whose specificity could beat the current best (it does skip
  regex eval for routes that can't win).
- Files: `src/core/src/utils/core/match.ts`.
- Cause: correctness fix for specificity ordering trades early-exit for a full pass.
- Improvement path: fine for typical controller sizes; if route counts grow large,
  pre-sort `controller.routes` by specificity at `collectRoutes` time so the first hit
  is the answer.

**Rate limiting is in-memory by default:**
- Problem: `MemoryStore` state is per-process and lost on restart.
- Files: `src/core/src/utils/core/ratelimit/store.ts` (`MemoryStore`),
  `src/core/src/utils/core/ratelimit/strategies.ts`.
- Cause: default; a `RateLimitStore` interface exists for swapping in Redis.
- Improvement path: ship or document a Redis-backed `RateLimitStore`.

## Fragile Areas

**~~Request pipeline has parallel compiled / uncompiled branches~~ — RESOLVED, was stale:**
- Re-checked 2026-09-11 against current `src/core/src/utils/core/controller.ts`: there
  is exactly one fallback site per function — `const compiled = route.compiled ??
  buildCompiledMiddleware(route.functions)` in `execute` (line 87) and `beforeRequest`
  (line 339) — not a parallel branch per pipeline stage. Every stage after that line
  reads uniformly from the single `compiled` object; there's nothing to diverge.
  `collectRoutes`, the only path that builds a real `Route` in production, always sets
  `compiled` (line 427), so the fallback only fires for hand-built `Route` objects
  (tests calling `execute`/`beforeRequest` directly). Both call sites are exercised:
  `__tests__/helpers/http.ts`'s `makeRoute()` never sets `compiled`, so most unit tests
  already hit the fallback branch; e2e/integration tests hit the `collectRoutes` path.
  No fix needed.

**`Helios.ts` (496 lines, largest file):**
- Files: `src/http/src/Helios.ts`.
- Why fragile: interleaves `node:http` wiring, the 8-step request order, plugin hooks,
  optional WebSocket/SSE servers, and optional GraphQL (WS and GraphQL are mutually
  exclusive). Coverage 79.89% stmts / 66.18% branches.
- Safe modification: keep the documented request order (plugin beforeRequest -> global
  CORS -> static -> config -> global mw -> plugin beforeRoute -> controllers ->
  sendResponse); add tests before touching the WS/GraphQL branch selection.

**Decorator metadata / `reflect-metadata`:**
- Files: all decorator files; `vitest.setup.ts` imports `reflect-metadata`.
- Why fragile: metadata keys from `src/core/src/constants.ts` are the only contract
  between the `@heliosjs/middlewares` decorators and core's constructor-time
  compilation; a missing polyfill import at an entry point breaks everything silently.
- Safe modification: push metadata only through `defineControllerMeta` /
  `defineMiddlewaresMeta`.

**AWS event normalizers (326 lines):**
- Files: `src/aws/src/utils/aws/lambda.event.normalizers.ts`.
- Why fragile: hand-rolled branching across three event shapes (REST, HTTP API v2,
  function URL); no real Lambda payload fixtures under test in `coverage.exclude`? (grpc
  is excluded; aws is not) — covered by `__tests__/aws/unit/normalizers.test.ts` but
  against synthetic events.
- Safe modification: add captured real event JSON as fixtures.

## Scaling Limits

**Single-instance rate limiting:**
- Current capacity: unbounded in-memory.
- Limit: no cross-instance sync; resets on restart.
- Scaling path: implement `RateLimitStore` against Redis (interface already exists in
  `src/core/src/types/core/ratelimit.ts`).

**WebSocket has no horizontal scaling:**
- Current capacity: single process; connections held in
  `src/core/src/utils/socket/server.ts`.
- Limit: no pub/sub fan-out across instances.
- Scaling path: sticky sessions plus an external broker, or an external WS service.

## Dependencies at Risk

**`type-graphql` 2.0.0-rc.3:**
- Risk: release candidate; API may shift.
- Impact: GraphQL integration in `@heliosjs/http`.
- Mitigated 2026-09-11: `type-graphql`, `graphql-yoga`, and `graphql-ws` moved from
  regular `dependencies` to optional `peerDependencies` in `src/http/package.json`
  (`@heliosjs/http` major, changeset `graphql-optional-peers.md`) — matches the
  peer-optional pattern `@heliosjs/core` already uses for `ajv`/`class-validator`/`joi`.
  This also fixed a real bug: `graphql-ws` was never declared as a dependency of
  `@heliosjs/http` at all (it only resolved in this monorepo by accident, hoisted from
  the root); a standalone install with GraphQL enabled would have thrown `Cannot find
  module 'graphql-ws/use/ws'` at runtime. Consumers now pin their own compatible
  version instead of being force-fed the RC transitively.
- Remaining: still an RC by upstream; STABILITY.md doesn't carve out GraphQL as
  experimental (deliberate, per that doc) — the RC-ness itself isn't this repo's to fix.

**`@grpc/grpc-js` pinned via `resolutions`:**
- Risk: forced single version repo-wide; can mask peer conflicts and lag security fixes.
- Impact: `@heliosjs/grpc` server/client.
- Migration plan: revisit the resolution each release; drop it once transitive ranges agree.

**Vitest 4.x + `oxc.decoratorLegacy`:**
- Risk: legacy-decorator support in the oxc transform is comparatively new; a vitest
  minor could change decorator emit and break the whole suite at once.
- Impact: all tests (they import packages from source, transformed by oxc).
- Migration plan: pin vitest minor; keep `yarn build` (real `tsc`) as the independent check.

## Missing Critical Features

**No health / readiness endpoint:**
- Problem: no built-in `/health` or `/ready`.
- Blocks: k8s probes, load-balancer checks without hand-rolling a controller.

**~~No graceful shutdown~~ — RESOLVED, was stale:**
- Re-checked 2026-09-11: `Helios.listen()` (`src/http/src/Helios.ts:190-191`) registers
  `process.once('SIGTERM'/'SIGINT', this.handleShutdownSignal)`, which calls `close()`;
  `close()` removes those listeners and drains via `http.Server.close()` plus the
  `onStop` plugin hook. This was fixed by the production-audit pass referenced in
  project memory; this doc just wasn't updated to match. No fix needed.

## Test Coverage Gaps

**`src/http/src/Helios.ts` lifecycle & optional servers — mostly closed 2026-09-12:**
- Now tested: `listen()` real bind, `close()`, GraphQL wiring (`setupGraphQL` end to
  end — schema build, yoga creation, the graphql-path routing middleware, the
  `useServer`/pubSub branch), nested-controller collection.
- Files: `src/http/src/Helios.ts`, now 90%+ stmts / 77%+ branches (was 79.89%/66.18%).
- Still open: constructor `log: false`, `close()`'s bind-error path, a plugin hook
  throwing mid-`requestHandler`, static-middleware-ends-response. Lower risk than what
  got closed (startup/shutdown/GraphQL); pick up if touching this file again.
- Priority: Low (was High).

**gRPC server/client — now covered, was excluded from coverage entirely:**
- `coverage.exclude` no longer excludes `src/grpc/src/**`; `server.ts` is at 99% stmts /
  98% branches (was excluded), `module.ts` similarly closed from a previously-thin
  existing test file that never exercised `clients`/`server` config or `start`/`stop`.
- Priority: Done — watch for regressions as the gate now actually measures this.

**Lambda adapter:**
- What's not tested end to end: `app.handler` dispatch, response formatting, CORS on
  Lambda, base64/binary handling.
- Files: `src/aws/src/lambda.ts`, `src/aws/src/utils/aws/*.ts`.
- Risk: deploy-only failures.
- Priority: Medium. (Untouched by the 2026-09-12 pass — still open.)

**WebSocket / SSE servers — now covered, was excluded from both exclude lists:**
- `socket/server.ts` 76%→99% stmts (added: real `ws` "connection" event wiring, the
  `handleUpgrade` callback, socket message/close/error event wiring, `triggerHandlers`'
  full handler/topic-subscription loop including the error-catch branches).
- `sse/server.ts` 85%→97% stmts (added: the `res.on('close', ...)` cleanup path,
  `triggerHandlers` dispatch/error-catch, `sendToClient`'s catch branch) — this is also
  where the synchronous-handler crash bug (Known Bugs) was found.
- Priority: Done.

**Uncompiled pipeline fallback:**
- What's not tested thoroughly: the `route.compiled` absent branch of `execute` and the
  `extractMiddlewares` fallbacks in `beforeRequest`.
- Files: `src/core/src/utils/core/controller.ts`.
- Risk: divergence from the compiled path after edits.
- Priority: Medium.

---

*Concerns audit: 2026-09-10*
