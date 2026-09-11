---
"@heliosjs/core": patch
"@heliosjs/http": patch
"@heliosjs/aws": patch
"@heliosjs/grpc": patch
---

Pre-production audit fixes:

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
