# @heliosjs/grpc

## 2.1.18

### Patch Changes

- 417fee1: Fix `GrpcClient` tracking only a single grpc-js client instance in a field
  that every `getService()` call overwrote. Two bugs from this:

  - `close()` iterated the wrapped observable-returning proxies (which don't
    have a `.close` method) instead of the real grpc-js clients, so it never
    actually closed any channel — every `getService()` call opened a
    connection that was never released.
  - Calling more than one service from the same `GrpcClient` was worse than a
    leak: after `getService('B')` overwrote the shared field, a previously
    returned wrapper for service `A` would silently start invoking its method
    names against `B`'s underlying client instead.

  Real client instances are now tracked per service name, so `close()` shuts
  down every channel and each service's methods always call the client they
  were created for.

- 417fee1: Fix a server-streaming RPC's `Observable` subscription never being torn
  down when the client cancels or disconnects. Any upstream resource behind
  it (an interval, a DB change-stream, a queue subscription) kept running
  indefinitely per cancelled call. The subscription is now unsubscribed on
  the call's `'cancelled'` event.
- Updated dependencies [417fee1]
- Updated dependencies [417fee1]
- Updated dependencies [417fee1]
- Updated dependencies [417fee1]
  - @heliosjs/core@4.0.3

## 2.1.17

### Patch Changes

- 9ba9f48: Log a warning when `GrpcClient`/`GrpcServer` silently fall back to
  `createInsecure()` because no `credentials` option was passed, so running
  without TLS is a visible choice rather than a silent default.
- Updated dependencies [9ba9f48]
- Updated dependencies [9ba9f48]
  - @heliosjs/core@4.0.2

## 2.1.16

### Patch Changes

- Widen the `@heliosjs/core` peer dependency range to `>=3.2.11 <5.0.0` so it accepts `@heliosjs/core@4.0.0` — the previous `^3.2.11` range rejected it, which would have made `npm install` fail with an unresolvable peer dependency conflict for anyone installing this package alongside the new core major.
- Bump the `@grpc/grpc-js` dependency floor from `^1.14.3` to `^1.14.4`, fixing two high-severity advisories (GHSA-5375-pq7m-f5r2, GHSA-99f4-grh7-6pcq) where a malformed or malformed-compressed request could crash the client or server.

## 2.1.15

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

- Updated dependencies [61b4c76]
- Updated dependencies [461d686]
- Updated dependencies [61b4c76]
  - @heliosjs/core@3.2.11

## 2.1.14

### Patch Changes

- documentation

## 2.1.13

### Patch Changes

- documentation

## 2.1.12

### Patch Changes

- bug fixes

## 2.1.11

### Patch Changes

- bug fixes + test coverage

## 2.1.10

### Patch Changes

- rate limit

## 2.1.9

### Patch Changes

- roles guard

## 2.1.8

### Patch Changes

- Stabilyzed dependency
- Improve source-code documentation quality and stabilize dependency management across the monorepo.

  - add comprehensive JSDoc for primary runtime usage methods (HTTP, Lambda, gRPC, WebSocket, SSE)
  - standardize and pin dependency versions for deterministic installs
  - align changesets publishing behavior for public npm packages

## 2.1.7

### Patch Changes

- version fixes

## 2.1.6

### Patch Changes

- route fix

## 2.1.5

### Patch Changes

- fixed pipe type

## 2.1.4

### Patch Changes

- Refactored controller prototype

## 2.1.3

### Patch Changes

- guard

## 2.1.2

### Patch Changes

- guard

## 2.1.1

### Patch Changes

- feat(guard): added types

## 2.1.0

### Minor Changes

- middlewares order

## 2.0.0

### Major Changes

- restructured dependencies

## 1.3.10

### Patch Changes

- fix

## 1.3.9

### Patch Changes

- fix

## 1.3.8

### Patch Changes

- fix

## 1.3.7

### Patch Changes

- fix

## 1.3.6

### Patch Changes

- fix

## 1.3.5

### Patch Changes

- fic(parser)

## 1.3.4

### Patch Changes

- body parser

## 1.3.3

### Patch Changes

- fix

## 1.3.2

### Patch Changes

- fix

## 1.3.1

### Patch Changes

- fix

## 1.3.0

### Minor Changes

- hashes

## 1.2.0

### Minor Changes

- 3a3127e: added grpc

### Patch Changes

- 3a3127e: chore

## 1.1.0

### Minor Changes

- 6716ef1: added grpc

### Patch Changes

- bump
- 6716ef1: chore
