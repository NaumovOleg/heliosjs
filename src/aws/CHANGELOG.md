# Change Log

## 10.0.8

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

## 10.0.7

### Patch Changes

- documentation
- Updated dependencies
  - @heliosjs/core@3.2.10

## 10.0.5

### Patch Changes

- documentation
- Updated dependencies
  - @heliosjs/core@3.2.8

## 10.0.4

### Patch Changes

- bug fixes
- Updated dependencies
  - @heliosjs/core@3.2.7

## 10.0.3

### Patch Changes

- bug fixes + test coverage
- Updated dependencies
  - @heliosjs/core@3.2.6

## 10.0.2

### Patch Changes

- cors fixes
- Updated dependencies
  - @heliosjs/core@3.2.2

## 10.0.1

### Patch Changes

- lambda url fix

## 10.0.0

### Minor Changes

- added http query method support

### Patch Changes

- Updated dependencies
  - @heliosjs/core@3.2.0

## 10.0.0

### Patch Changes

- Updated dependencies
  - @heliosjs/core@4.0.0

## 9.0.15

### Patch Changes

- rate limit
- Updated dependencies
  - @heliosjs/core@3.1.16

## 9.0.14

### Patch Changes

- fingerprint
- Updated dependencies
  - @heliosjs/core@3.1.15

## 9.0.13

### Patch Changes

- roles guard
- Updated dependencies
  - @heliosjs/core@3.1.14

## 9.0.12

### Patch Changes

- Stabilyzed dependency
- Improve source-code documentation quality and stabilize dependency management across the monorepo.

  - add comprehensive JSDoc for primary runtime usage methods (HTTP, Lambda, gRPC, WebSocket, SSE)
  - standardize and pin dependency versions for deterministic installs
  - align changesets publishing behavior for public npm packages

- Updated dependencies
- Updated dependencies
  - @heliosjs/core@3.1.13

## 9.0.11

### Patch Changes

- version fixes
- Updated dependencies
  - @heliosjs/core@3.1.12

## 9.0.10

### Patch Changes

- removed console
- Updated dependencies
  - @heliosjs/core@3.1.11

## 9.0.9

### Patch Changes

- fixed error handling
- Updated dependencies
  - @heliosjs/core@3.1.10

## 9.0.8

### Patch Changes

- route fix
- Updated dependencies
  - @heliosjs/core@3.1.9

## 9.0.7

### Patch Changes

- fixed pipe type
- Updated dependencies
  - @heliosjs/core@3.1.8

## 9.0.6

### Patch Changes

- Refactored controller prototype
- Updated dependencies
  - @heliosjs/core@3.1.7

## 9.0.5

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@3.1.6

## 9.0.4

### Patch Changes

- chore
- Updated dependencies
  - @heliosjs/core@3.1.4

## 9.0.3

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@3.1.3

## 9.0.2

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@3.1.2

## 9.0.3

### Patch Changes

- guard
- Updated dependencies
  - @heliosjs/core@3.1.3

## 9.0.2

### Patch Changes

- guard
- Updated dependencies
  - @heliosjs/core@3.1.2

## 9.0.1

### Patch Changes

- feat(guard): added types
- Updated dependencies
  - @heliosjs/core@3.1.1

## 9.0.0

### Minor Changes

- middlewares order

### Patch Changes

- Updated dependencies
  - @heliosjs/core@3.1.0

## 8.0.0

### Major Changes

- restructured dependencies

### Patch Changes

- Updated dependencies
  - @heliosjs/core@3.0.0

## 7.0.10

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.10

## 7.0.9

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.9

## 7.0.8

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.8

## 7.0.7

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.7

## 7.0.6

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.6

## 7.0.5

### Patch Changes

- fic(parser)
- Updated dependencies
  - @heliosjs/core@2.4.5

## 7.0.4

### Patch Changes

- body parser
- Updated dependencies
  - @heliosjs/core@2.4.4

## 7.0.3

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.3

## 7.0.2

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.2

## 7.0.1

### Patch Changes

- fix
- Updated dependencies
  - @heliosjs/core@2.4.1

## 7.0.0

### Minor Changes

- hashes

### Patch Changes

- Updated dependencies
  - @heliosjs/core@2.4.0

## 6.0.0

### Minor Changes

- 3a3127e: added grpc

### Patch Changes

- fix
- 3a3127e: chore
- Updated dependencies [3a3127e]
- Updated dependencies [3a3127e]
  - @heliosjs/core@2.3.0

## 5.0.0

### Minor Changes

- 6716ef1: added grpc

### Patch Changes

- bump
- 6716ef1: chore
- Updated dependencies
- Updated dependencies [6716ef1]
- Updated dependencies [6716ef1]
  - @heliosjs/core@2.2.0

## 4.0.4

### Patch Changes

- chore
- Updated dependencies
  - @heliosjs/core@2.1.4

## 4.0.3

### Patch Changes

- type fixes
- Updated dependencies
  - @heliosjs/core@2.1.3

## 4.0.2

### Patch Changes

- chore
- Updated dependencies
  - @heliosjs/core@2.1.2

## 4.0.1

### Patch Changes

- 38a9d8a: fix
- Updated dependencies [38a9d8a]
  - @heliosjs/core@2.1.1

## 4.0.0

### Minor Changes

- refactored controllers

### Patch Changes

- Updated dependencies
  - @heliosjs/core@2.1.0

## 3.0.0

### Major Changes

- meta

### Patch Changes

- 266a867: fixes
- Updated dependencies
- Updated dependencies [266a867]
  - @heliosjs/core@2.0.0

## 2.0.1

### Patch Changes

- a0ee0fc: http fixes
- Updated dependencies [a0ee0fc]
  - @heliosjs/core@1.4.1

## 2.0.0

### Minor Changes

- 73d74d9: routing

### Patch Changes

- Updated dependencies [73d74d9]
- Updated dependencies [daf13f1]
  - @heliosjs/core@1.4.0

## 1.3.4

### Patch Changes

- b396669: test
- Updated dependencies [b396669]
  - @heliosjs/core@1.3.5

## 1.3.3

### Patch Changes

- c103eb9: fixes
- Updated dependencies [d0a4da9]
- Updated dependencies [c103eb9]
  - @heliosjs/core@1.3.4

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.3.1 (2026-03-29)

**Note:** Version bump only for package @heliosjs/aws

## 1.0.19 (2026-03-29)

**Note:** Version bump only for package @heliosjs/aws

## 1.0.13 (2026-03-29)

**Note:** Version bump only for package @heliosjs/aws
