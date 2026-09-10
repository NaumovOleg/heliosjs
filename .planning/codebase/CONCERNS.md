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

**`yarn test:coverage` fails — thresholds not met on master:**
- Current: statements 94.01% (thr 95), branches 86.26% (thr 88), functions 94.94%
  (thr 96), lines 94.52% (thr 96). All four below. Original doc's numbers were stale.
- Files: `vitest.config.ts` (`test.coverage.thresholds`).
- The `coverage.exclude` list hides `**/socket/server.ts`, `**/socket/socket.ts`,
  `**/sse/server.ts`, and nearly all of `src/grpc/src/**` (`server.ts`, `client.ts`,
  `module.ts`, `utils/**`). Real coverage of the shipped surface is lower than the
  numbers imply. Biggest measured gap: `src/http/src/Helios.ts` at 79.89% stmts /
  66.18% branches (uncovered: server `listen`/`close`, WS/SSE/GraphQL wiring).
- Fix approach: lower thresholds to the current floor to make the gate meaningful
  again, or add tests for `Helios.ts` lifecycle and `src/core/src/utils/core/error/apperror.ts`
  (94%), then ratchet up.

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

**Request pipeline has parallel compiled / uncompiled branches:**
- Files: `src/core/src/utils/core/controller.ts` (`execute`, `beforeRequest`,
  `buildCompiledMiddleware`, `collectRoutes`).
- Why fragile: nearly every stage (interceptors, error handlers, status, params) has a
  `route.compiled?.X ?? extractMiddlewares(route.functions, 'x')` fallback. `20b5099`
  reworked both: interceptors always apply in reverse; `runErrorHandlers` unifies
  newest-first error-handler execution; the FORBIDDEN/NOT_FOUND/RATE_LIMIT/UNAUTHORIZED
  short-circuit now fires only when `handlerCount === 0` (an explicit `@Catch` overrides
  it). Any behavior change must be mirrored in both branches or the compiled and
  uncompiled paths diverge silently.
- Safe modification: change both branches together; assert parity in
  `__tests__/core/pipeline-execute.test.ts` and `pipeline-before-request.test.ts`.
- Test coverage: `src/core/src/utils/core/controller.ts` is well covered by the pipeline
  suites; the uncompiled fallback path is less exercised than the compiled one.

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
- Migration plan: pin exact version, gate GraphQL as clearly experimental.

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

**No graceful shutdown:**
- Problem: `Helios.close()` exists (`src/http/src/Helios.ts:206`) but nothing installs
  `SIGTERM` / `SIGINT` handlers or drains in-flight requests.
- Blocks: clean container termination; risk of dropped requests on deploy.

## Test Coverage Gaps

**`src/http/src/Helios.ts` lifecycle & optional servers:**
- What's not tested: `listen()` real bind, `close()`, WS/SSE server startup, GraphQL
  wiring, plugin hook ordering.
- Files: `src/http/src/Helios.ts` (79.89% stmts, 66.18% branches).
- Risk: startup/shutdown and transport-wiring regressions escape to deploy.
- Priority: High.

**gRPC server/client — excluded from coverage entirely:**
- What's not tested (per `vitest.config.ts` `coverage.exclude`): `src/grpc/src/server.ts`,
  `client.ts`, `module.ts`, `utils/**`. Unit tests exist
  (`__tests__/grpc/unit/*`) but `server-extended.test.ts` is excluded from the run.
- Risk: service registration, method dispatch, rxjs streaming regressions invisible to
  the coverage gate.
- Priority: Medium.

**Lambda adapter:**
- What's not tested end to end: `app.handler` dispatch, response formatting, CORS on
  Lambda, base64/binary handling.
- Files: `src/aws/src/lambda.ts`, `src/aws/src/utils/aws/*.ts`.
- Risk: deploy-only failures.
- Priority: Medium.

**WebSocket / SSE servers:**
- What's not tested: connection lifecycle, broadcast, backpressure. Server files are in
  both the test `exclude` and `coverage.exclude` lists.
- Files: `src/core/src/utils/socket/server.ts`, `src/core/src/utils/sse/server.ts`.
- Risk: real-time feature regressions.
- Priority: Low.

**Uncompiled pipeline fallback:**
- What's not tested thoroughly: the `route.compiled` absent branch of `execute` and the
  `extractMiddlewares` fallbacks in `beforeRequest`.
- Files: `src/core/src/utils/core/controller.ts`.
- Risk: divergence from the compiled path after edits.
- Priority: Medium.

---

*Concerns audit: 2026-09-10*
