# Change Log

## 3.2.11

### Patch Changes

- 61b4c76: Bug-fix and cleanup pass across the request pipeline (see `.planning/audit-fixes-2026-09.md`
  for the full list). Some of these are user-visible behavior changes, not just internal fixes:

  - `res.stream()` now actually pipes a readable instead of `JSON.stringify`-ing it; `res.buffer()`
    and Buffer response bodies are no longer corrupted (Lambda responses are base64-encoded when
    the body is binary).
  - Lambda: responses now emit `response.cookies` (previously echoed the request's cookies).
  - Malformed JSON request bodies now reply `400` instead of passing the raw string through to the
    handler.
  - `HEAD` requests now fall back to the matching `GET` handler (body suppressed) instead of 404ing
    when no explicit `@Head` route exists.
  - New `trustProxy` option (`http` default `false`, `aws` default `true`): `X-Forwarded-*` headers
    are only trusted when explicitly enabled — previously always trusted, which let a client spoof
    its IP into rate-limit/fingerprint keys.
  - `@Headers`/`@Cookies`/`@Files` accept a DTO for validation; header lookups (including CORS) are
    case-insensitive.
  - Route-array middlewares (`@Use([a, b])`) now run in declared order (previously reversed).
  - Multipart text fields keep their original string type instead of being blanket `JSON.parse`d.
  - `MemoryStore` (rate limiting) is now bounded (default 10k entries, drop-oldest) instead of
    growing unboundedly under a large/hostile key space.

  Plus perf work (single request pipeline, O(n²)→O(n) param resolution, shared MIME table) and
  dead-code removal with no behavior change.

- 461d686: Hot-path perf pass (~5-7% throughput on the routing benchmark — see
  `.planning/codebase/BENCHMARK-AUDIT-PHASE2.md`) plus two small additions,
  both covered by the new comparative benchmark suites (middleware/validation/
  serialization — see `.planning/codebase/BENCHMARK-SUITE-PLAN.md`):

  - **New**: `request.signal` (`AbortSignal`, HTTP only — `undefined` on
    Lambda/`@heliosjs/aws`, which has no live connection to abort on). Aborts
    if the client disconnects before a response was sent; pass it straight
    into `fetch()` or most DB drivers to stop wasted work once nobody's
    listening for the result. Lazy — nothing is allocated or listened to
    unless a handler actually reads it.
  - **New**: a route with an inline regex param (`:id(pattern)`) now gets a
    one-time warning at registration (not per-request) if the pattern looks
    like it risks catastrophic backtracking (ReDoS) — a heuristic nudge, not
    a hard block. `looksReDoSRisky` is exported from `@heliosjs/core/utils`
    if you want to run the same check yourself.
  - **Behavior change, `@heliosjs/http` only**: `Request.requestId` is no
    longer a `crypto.randomUUID()` — it's now a fast per-process counter
    (`<random-tag>-<n>`). Still unique per request and fine for log
    correlation, but no longer parses as a UUID. Calling this out explicitly
    since it's the one change here that could break something depending on
    the old format; `@heliosjs/aws` (Lambda) is untouched.
  - Perf, no behavior change: `execute()` skips its own pre-handler pass
    entirely for routes with no guards/pipes/sanitizers/middlewares/rate
    limits (previously walked four empty arrays every request); a handler's
    return value is only `await`-ed when it's actually a promise; `Req`'s
    per-request state `Map` is now allocated lazily instead of on every
    request; `Helios.sendResponse` no longer sets `Content-Type` a second
    time with the value it's already set to.

- 61b4c76: Pre-production audit fixes:

  - **`@heliosjs/aws`**: dropped the `aws-lambda` runtime dependency (a CLI deploy tool that pulls
    in AWS SDK v2 and a vulnerable transitive `uuid`) — all imports from `'aws-lambda'` in this
    package are type-only, so the correct dependency is `@types/aws-lambda`, which now replaces it.
    No code change; smaller install, one less vulnerable dependency.
  - **`@heliosjs/http`**: `graphql-yoga` is now a declared dependency. The GraphQL integration
    already did `import('graphql-yoga')` at runtime, but the package was never listed — enabling
    GraphQL crashed with a module-not-found error on a clean install.
  - **`@heliosjs/grpc`**: declares `@heliosjs/core` as a peer dependency (it already imports
    `Logger` and shared types from it at runtime).
  - **`@heliosjs/http`**: `Helios.listen()` now closes the server on `SIGTERM`/`SIGINT`, draining
    in-flight requests via the existing `close()` instead of the process being killed mid-request
    on a container/orchestrator shutdown.
  - **`@heliosjs/http`**: a request body over `bodyLimit` no longer resets the TCP connection —
    the client now gets a proper `413` JSON response (`Connection: close` to avoid reusing a socket
    with an undrained body) instead of `ECONNRESET`.
  - **`@heliosjs/core`**: a thrown non-`Error` value with no `@Catch` handler is now logged instead
    of being silently dropped.

  Also bumped the `ws` and `protobufjs` transitive versions (via `resolutions`) to clear a high and
  a critical advisory; removed a stray, git-tracked `package-lock.json` that didn't match this
  yarn-only workspace and was making `npm audit` report already-fixed versions as vulnerable.

## 3.2.10

### Patch Changes

- documentation

## 3.2.9

### Patch Changes

- 1a53ea5: Performance optimizations closing ~20% of the gap to Fastify:

  - **Compiled route regex**: Pre-compile route regex patterns at startup (`compileRouteRegex`), stored as `route.compiledRegex` for fast matching in `matchRoutes()`
  - **Pre-partitioned middleware**: Build `CompiledMiddleware` (guards, pipes, middlewares, interceptors, error handlers, CORS, rate limits) once at startup instead of filtering per-request
  - **Lazy body parsing**: Skip `collectRawBody()` for GET/HEAD/OPTIONS requests that don't need it
  - **Single URL allocation**: Pass pre-allocated `requestUrl` into `Request` constructor to avoid repeated `new URL()` calls
  - **Pre-compiled param extractor**: Build regex-based param extractor once per route at startup, stored as `route.compiledParamExtractor`

  Results: Helios ~80.5k req/s (was ~72.9k, +10.5%), now at ~78% of Fastify's throughput (was ~72%). All 1349 tests passing.

## 3.2.8

### Patch Changes

- documentation

## 3.2.7

### Patch Changes

- bug fixes

## 3.2.6

### Patch Changes

- bug fixes + test coverage

## 3.2.5

### Patch Changes

- redirect fixes

## 3.2.4

### Patch Changes

- error handling fixes

## 3.2.3

### Patch Changes

- cors fixes

## 3.2.2

### Patch Changes

- cors fixes

## 3.2.1

### Patch Changes

- yarn version-packages
- route fixes

## 3.2.0

### Minor Changes

- added http query method support

## 4.0.0

### Major Changes

- Add support for the HTTP `QUERY` method.

  - `HTTP_METHODS.QUERY` was added to the method enum.
  - A new `@Query(path, middlewares)` endpoint decorator registers a `QUERY` route.

  **Breaking:** the `@Query()` parameter decorator, which extracts query string
  parameters from the URL, is renamed to `@QueryParam()`. The name `Query` now
  belongs to the endpoint decorator.

  ```diff
  -  @Get('/search')
  -  search(@Query('q') q: string) {}
  +  @Get('/search')
  +  search(@QueryParam('q') q: string) {}
  ```

## 3.1.16

### Patch Changes

- rate limit

## 3.1.15

### Patch Changes

- fingerprint

## 3.1.14

### Patch Changes

- roles guard

## 3.1.13

### Patch Changes

- Stabilyzed dependency
- Improve source-code documentation quality and stabilize dependency management across the monorepo.

  - add comprehensive JSDoc for primary runtime usage methods (HTTP, Lambda, gRPC, WebSocket, SSE)
  - standardize and pin dependency versions for deterministic installs
  - align changesets publishing behavior for public npm packages

## 3.1.12

### Patch Changes

- version fixes

## 3.1.11

### Patch Changes

- removed console

## 3.1.10

### Patch Changes

- fixed error handling

## 3.1.9

### Patch Changes

- route fix

## 3.1.8

### Patch Changes

- fixed pipe type

## 3.1.7

### Patch Changes

- Refactored controller prototype

## 3.1.6

### Patch Changes

- fix

## 3.1.5

### Patch Changes

- fix

## 3.1.4

### Patch Changes

- chore

## 3.1.3

### Patch Changes

- fix

## 3.1.2

### Patch Changes

- fix

## 3.1.3

### Patch Changes

- guard

## 3.1.2

### Patch Changes

- guard

## 3.1.1

### Patch Changes

- feat(guard): added types

## 3.1.0

### Minor Changes

- middlewares order

## 3.0.0

### Major Changes

- restructured dependencies

## 2.4.10

### Patch Changes

- fix

## 2.4.9

### Patch Changes

- fix

## 2.4.8

### Patch Changes

- fix

## 2.4.7

### Patch Changes

- fix

## 2.4.6

### Patch Changes

- fix

## 2.4.5

### Patch Changes

- fic(parser)

## 2.4.4

### Patch Changes

- body parser

## 2.4.3

### Patch Changes

- fix

## 2.4.2

### Patch Changes

- fix

## 2.4.1

### Patch Changes

- fix

## 2.4.0

### Minor Changes

- hashes

## 2.3.0

### Minor Changes

- 3a3127e: added grpc

### Patch Changes

- 3a3127e: chore

## 2.2.0

### Minor Changes

- 6716ef1: added grpc

### Patch Changes

- bump
- 6716ef1: chore

## 2.1.4

### Patch Changes

- chore

## 2.1.3

### Patch Changes

- type fixes

## 2.1.2

### Patch Changes

- chore

## 2.1.1

### Patch Changes

- 38a9d8a: fix

## 2.1.0

### Minor Changes

- refactored controllers

## 2.0.0

### Major Changes

- meta

### Patch Changes

- 266a867: fixes

## 1.4.1

### Patch Changes

- a0ee0fc: http fixes

## 1.4.0

### Minor Changes

- 73d74d9: routing

### Patch Changes

- daf13f1: exported custom errors

## 1.3.5

### Patch Changes

- b396669: test

## 1.3.4

### Patch Changes

- d0a4da9: fixes
- c103eb9: fixes

## 1.3.2

### Patch Changes

- 14def7d: feat(workflow-fixes)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.3.1 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler

## 1.0.16 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler

## 1.0.11 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler
