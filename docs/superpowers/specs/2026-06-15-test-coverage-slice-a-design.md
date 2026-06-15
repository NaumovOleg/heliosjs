# Test Coverage — Slice A: Core Request Pipeline & Routing — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

The HeliosJS framework is almost entirely untested — the only existing tests
cover the recently added RBAC, fingerprint, and DoS-hardening features. This is
the first slice of a multi-slice test-coverage effort. Slice A covers the
**core request pipeline and routing**: route matching, request parsers, and the
per-request execution/middleware pipeline. It also introduces reusable test
builders and a coverage gate (ratchet) wired into CI, so coverage is measured
and enforced and later slices raise the bar.

This slice is HTTP/core only. gRPC, sockets/SSE, AWS event normalizers, the
error-system internals, CORS/sanitize internals, and the Request/Response
factories are explicitly out of scope (later slices).

## Goals

- Cover route matching (`matchRoutes`), the request parsers (`parseQuery`,
  `parseBody`, `parseRequestCookie`, `parseHeaders`), and the execution pipeline
  (`execute`, `beforeRequest`, `runGuard`) to a meaningful threshold.
- Provide reusable test builders (`makeRequest`, `makeResponse`, `makeRoute`,
  `makeControllerMeta`) that later slices also use.
- Add a coverage tool + threshold gate scoped to the tested files, wired into
  CI, that future slices extend.

## Non-Goals

- No production-code refactor beyond what a test legitimately forces. Where a
  test exposes an existing bug, **surface it** (document/flag), don't silently
  rewrite framework behavior in this slice.
- No coverage of out-of-scope packages/modules listed above.

## Background

All target functions are already exported — no refactor needed to test them:

- `core/src/utils/core/match.ts` — `matchRoutes(controller, requestPath, requestMethod)`
  returns the single best-matching `Route` (or `undefined`). It normalizes the
  path, filters by method, extracts params/wildcards, and sorts matches.
  **Known risk:** the final sort reads `route.fullPath` (`a.fullPath.includes('*')`,
  `b.fullPath.length`), but the `Route` type exposes `route`, not `fullPath`.
  Tests should construct `Route`s the way the framework actually produces them
  and surface any resulting `undefined`/throw as a finding rather than papering
  over it.
- `core/src/utils/shared/parsers.ts` — `parseQuery(url: URL)`,
  `parseBody({ body, headers, isBase64Encoded? })` (returns objects as-is;
  otherwise parses by `content-type`: JSON / urlencoded / text),
  `parseRequestCookie(cookies?)`, `parseHeaders(...)`. Pure.
- `core/src/utils/core/controller.ts`:
  - `execute(route, request, response)` — sets params, applies CORS, calls
    `beforeRequest`, resolves handler arguments by `param.type`, runs the
    handler, applies interceptors and status.
  - `beforeRequest(request, response, route)` — iterates `route.functions` and
    runs `sanitizer → guard → pipe → middleware` per item; a guard returning
    `false`/string throws `ForbiddenError`.
  - `runGuard(guard, request, response)` — already partially tested (function
    guards); extend to cover class and instance guards and the `message`
    property.

Tests run from the root Vitest runner (`yarn test`), `__tests__/**/*.test.ts`,
with `@heliosjs/core*` aliased to source. No coverage tooling is installed yet.

## Architecture

### 1. Shared test builders — `__tests__/helpers/http.ts`

A single module of minimal, typed stand-ins reused across this and later slices.
Each builder returns an object cast to the framework type, populated only with
what the code under test touches, and accepts overrides.

- `makeRequest(overrides?)` → `Request` — backs `getState/setState` with a `Map`;
  provides `method`, `url`, `path`, `params`, `query`, `body`, `headers`,
  `getHeader`, `getParam`, `getQuery`, `getClientIp`, `userAgent`, and the
  methods `execute`/`beforeRequest` actually call.
- `makeResponse(overrides?)` → `Response` — captures `status`, `error()`, and
  whatever the pipeline sets, for assertion.
- `makeRoute(overrides?)` → `Route` — `{ name, route, method, parameters, functions, fn, cors }`.
- `makeControllerMeta(overrides?)` → `ControllerMeta` — `{ routes, children, ... }`
  for `matchRoutes`.

The builders are kept minimal and honest: if the code under test needs a method,
the builder provides a real (not no-op) implementation so tests exercise behavior.

### 2. Test files (under `__tests__/core/`)

**`match.test.ts`** — `matchRoutes`:
- static path match; `:param` path match; wildcard (`*`) match;
- trailing-slash normalization; method filtering (no match on wrong method);
- no route → `undefined`; precedence (more specific path wins over wildcard).
- Surfaces the `fullPath` finding if it manifests.

**`parsers.test.ts`** — parsers:
- `parseQuery`: single value, repeated key → array, empty.
- `parseBody`: already-parsed object passthrough; JSON body; urlencoded body;
  plain text; empty/absent body → `undefined`; malformed JSON behavior.
- `parseRequestCookie`: multiple cookies, single, none/undefined.
- `parseHeaders`: normalization behavior.

**`pipeline-execute.test.ts`** — `execute`:
- argument resolution for each `param.type`: `param`, `query`, `body`,
  `headers`, `request`, `response`, `fingerprint`;
- default args `(request, response)` when the route declares no parameters;
- `@Status` applied to the response;
- interceptors applied to the handler result.

**`pipeline-before-request.test.ts`** — `beforeRequest`:
- runs items in order `sanitizer → guard → pipe → middleware`;
- a guard returning `false` or a string → `ForbiddenError` (pipeline stops);
- `pipe` transforms `body`/`query`/`params`/`headers`;
- error handlers are collected and invoked on a thrown error.

**`run-guard.test.ts`** (extend existing coverage) — `runGuard`:
- class guard (`canActivate`) allow/deny; instance guard; `message` override →
  custom `ForbiddenError` message. (Function-guard cases already exist in
  `__tests__/middlewares/runGuard.test.ts`; keep those, add the class/instance
  cases here or alongside.)

### 3. Coverage gate

- Add dev dependency `@vitest/coverage-v8` (matching the installed Vitest major).
- Extend the root `vitest.config.ts` with a `coverage` block scoped to the
  Slice-A target files so the (still untested) rest of the repo does not skew the
  number:
  ```ts
  coverage: {
    provider: 'v8',
    all: true,
    include: [
      'src/core/src/utils/core/match.ts',
      'src/core/src/utils/shared/parsers.ts',
      'src/core/src/utils/core/controller.ts',
    ],
    thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
  }
  ```
- Add a root script: `"test:coverage": "vitest run --coverage"`.
- Wire a coverage step into the existing CI test job (run `yarn test:coverage`).
- Future slices append their target files to `include` and raise thresholds —
  the ratchet.

> If a target file cannot realistically reach the threshold within this slice
> without testing out-of-scope collaborators, narrow `include` to the functions
> actually covered (split the file is not in scope) or adjust the threshold down
> to the achieved level and record it — the gate must pass on a true number, not
> an aspirational one.

## File-Change Summary

| Path                                            | Change                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| `__tests__/helpers/http.ts` (new)               | shared builders                                   |
| `__tests__/core/match.test.ts` (new)            | `matchRoutes` tests                               |
| `__tests__/core/parsers.test.ts` (new)          | parser tests                                      |
| `__tests__/core/pipeline-execute.test.ts` (new) | `execute` tests                                   |
| `__tests__/core/pipeline-before-request.test.ts` (new) | `beforeRequest` tests                      |
| `__tests__/core/run-guard.test.ts` (new)        | class/instance `runGuard` tests                   |
| `vitest.config.ts` (modify)                     | `coverage` block                                  |
| `package.json` (modify)                         | `@vitest/coverage-v8` dev dep + `test:coverage`   |
| CI workflow (modify)                            | coverage step in the test job                     |

## Testing / Verification

- `yarn test` — all suites green.
- `yarn test:coverage` — green and meets thresholds for the included files.
- Any production bug surfaced by a test (e.g. the `matchRoutes` `fullPath`
  issue) is recorded as a finding; fixing it is a separate, explicit decision —
  not folded silently into a test commit.

## Open Questions

None. Decomposition agreed (Slice A first; gRPC and sockets excluded). Depth
(pure units + pipeline) and the coverage gate are approved.
