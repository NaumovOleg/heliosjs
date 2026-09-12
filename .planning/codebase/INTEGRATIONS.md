# External Integrations

**Analysis Date:** 2026-09-10

> HeliosJS is a framework library, not a running application. "Integrations" here are the
> transports and third-party runtimes it adapts, plus the CI/publish pipeline. It calls no
> outbound APIs and connects to no databases of its own.

## APIs & External Services

**AWS Lambda (`@heliosjs/aws`):**
- Adapter in `src/aws/src/lambda.ts`; `app.handler` is the Lambda entry.
- SDK/Client: `aws-lambda` ^1.0.7 (types only), `@types/aws-lambda` 8.10.161.
- Normalizes these event shapes into the core `Request` (`src/aws/src/types/aws/lambda.ts`):
  API Gateway REST API v1 (`APIGatewayProxyEvent`), HTTP API v2 (`APIGatewayProxyEventV2`),
  ALB (`ALBEvent`), Lambda Function URL (`LambdaFunctionURLEvent`).
- Auth: none (library).

**gRPC (`@heliosjs/grpc`):**
- `GrpcServer` (`src/grpc/src/server.ts`), `GrpcClient` (`src/grpc/src/client.ts`) over `@grpc/grpc-js` ^1.14.3.
- Proto files loaded at runtime with `@grpc/proto-loader` `loadSync` (`^0.8.0`, undeclared dependency - resolves transitively via `@grpc/grpc-js`).
- Streaming exposed as `rxjs` ^7.8.2 observables.
- Mostly separate from the HTTP pipeline; imports `Logger`/types from core and declares `@heliosjs/core` as a peer dependency (`>=3.2.11 <5.0.0`, fixed in `ac10d74`).

**GraphQL (`@heliosjs/http`, optional):**
- Wired in `src/http/src/Helios.ts` (~line 429) via dynamic `import()` of `graphql-yoga` (`createYoga`, `createPubSub`), `type-graphql` (`buildSchema`), and `graphql-ws/use/ws` (`useServer`).
- Served at `/graphql`; subscriptions over WebSocket (`graphql-ws`).
- `type-graphql`, `graphql-yoga`, and `graphql-ws` are optional `peerDependencies` of `@heliosjs/http`; `graphql` and `graphql-scalars` are root devDependencies only. All must be installed by the consumer to use GraphQL.
- Cannot be enabled together with the raw WebSocket server.

**WebSocket (`@heliosjs/core` + `@heliosjs/http`):**
- `ws` ^8.19.0. `WebSocketService.getInstance()` singleton (`src/core/src/utils/socket/service.ts`), helpers in `src/core/src/utils/socket/socket.ts` (send to client, publish to topic, broadcast, stats).
- HTTP server attaches it (`src/http/src/socket/`); default path `/ws`.

**Server-Sent Events (`@heliosjs/core`):**
- `SSEService.getInstance()` (`src/core/src/utils/sse/service.ts`), server in `src/core/src/utils/sse/`. No external dependency.

## Data Storage

**Databases:** None. No ORM, no driver.

**File Storage:** Local filesystem only (static file serving via the HTTP static middleware). Proto files read from local disk by `@heliosjs/grpc`.

**Caching:** In-memory only.
- Rate-limit store `MemoryStore` (`src/core/src/utils/core/ratelimit/`), configured via `setRateLimitConfig`.
- Precompiled route regex/param-extractor/middleware buckets cached on the controller instance (`CONTROLLER_PRECOMPILED`).
- No Redis / Memcached.

## Authentication & Identity

**Auth Provider:** None built in.
- RBAC is consumer-supplied: `setRolesExtractor(fn)` (`src/core/src/utils/core/rbac.ts`) registers a callback that returns roles for a request; `@Roles` / `@Guard` decorators enforce.
- Request fingerprinting (`src/core/src/utils/core/fingerprint.ts`) uses `node:crypto` `createHash('sha256')` / `createHmac`; the HMAC secret is provided via `setFingerprintConfig`. Fingerprint is the default rate-limit key.
- Errors with `code` FORBIDDEN / UNAUTHORIZED / NOT_FOUND / RATE_LIMIT_EXCEEDED short-circuit to their own HTTP response unless the route declares `@Catch`.

## Monitoring & Observability

**Error Tracking:** None. Errors are serialized through `ApplicationError` subclasses (`src/core/src/utils/core/error/`), each carrying an HTTP `status`.

**Logs:**
- `Logger` in `src/core/src/utils/core/logger.ts`; global instance via `setGlobalLogger(config | false)`.
- `console` used for server startup banners; `no-console` is a lint warning (off for config/benchmarks).
- `LOG_ERRORS` env flag enables error-response logging.
- No external log transport / APM.

## CI/CD & Deployment

**Hosting:**
- Packages published to npm registry `https://registry.npmjs.org` as public `@heliosjs/*`.
- Docs site published to GitHub Pages.

**CI Pipeline (GitHub Actions):**
- `.github/workflows/publish.yml` ("Release") - on push to `master`/`main`: checkout (full history) -> Node 24 + `corepack enable` -> `yarn install --frozen-lockfile` -> `yarn build` -> delete stray `.npmrc` -> `yarn release` (`changeset publish --provenance --access public`). Uses `secrets.GITHUB_TOKEN`, `NPM_CONFIG_PROVENANCE=true`. No separate changeset version-PR job.
- `.github/workflows/docs.yml` ("Deploy Docs") - on push to `master`/`main` touching `helios-docs/**` (or manual): Node 24 -> `yarn docs:build` -> `actions/upload-pages-artifact` -> `actions/deploy-pages`.
- No test/lint job in CI.

## Environment Configuration

**Read at runtime (package source):**
- `NODE_ENV` - `production` disables error stack traces in responses.
- `LOG_ERRORS` - truthy enables error logging.

**Build/publish only:**
- `NPM_TOKEN` - npm auth, kept in a local `.env` (gitignored via `.gitignore` `.env`).
- `GITHUB_TOKEN` - provided by Actions for the release job.

**Secrets location:**
- Local `.env` (NOT committed; `.gitignore` excludes it). Note: the working-copy `.env` contains a real-looking `NPM_TOKEN` value - rotate if it was ever pushed.
- CI secrets in GitHub Actions.

## Webhooks & Callbacks

**Incoming:**
- HTTP request handler (`Helios`, `src/http/src/Helios.ts`) over `node:http`.
- AWS Lambda invocations (`app.handler`, `src/aws/src/lambda.ts`).
- WebSocket connections (default `/ws`).
- GraphQL over HTTP + subscriptions over WebSocket (`/graphql`, when enabled).
- SSE streams.
- gRPC method calls (`GrpcServer`).

**Outgoing:**
- None. `GrpcClient` makes outbound gRPC calls only when a consumer instantiates it.

---

*Integration audit: 2026-09-10*
