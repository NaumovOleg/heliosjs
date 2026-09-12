# Architecture

**Analysis Date:** 2026-09-10

## Pattern Overview

**Overall:** Decorator-driven API framework with a transport-adapter pattern. Decorators
write `Reflect` metadata; controllers compile that metadata into an executable route
table in their constructor; transport adapters (HTTP, Lambda, gRPC) feed normalized
requests into the same compiled controllers.

**Key Characteristics:**
- Decorators only *record* metadata (`Reflect.defineMetadata`). No runtime logic lives in
  a decorator. Keys are in `src/core/src/constants.ts` (`DECORATOR.controller`,
  `DECORATOR.route`, `DECORATOR.middlewares`).
- Compilation happens once, in `@Controller`'s wrapped constructor
  (`src/core/src/Controller.ts` -> `descriptors/meta.ts` -> `collectRoutes`).
- Routes are **precompiled**: each `Route` carries `compiledRegex`, `specificity`,
  `compiledParamExtractor`, and a `compiled` bucket of middleware split by kind
  (`buildCompiledMiddleware` in `src/core/src/utils/core/controller.ts`).
- The request pipeline (`execute` / `beforeRequest`) has two branches: a fast path over
  `route.compiled`, and an uncompiled fallback over `route.functions`. Both must stay
  behaviorally identical.
- ESM-only, Node 20+, Yarn 1 workspace monorepo, 5 published packages sharing
  `@heliosjs/core`.

## Layers

**Core (`@heliosjs/core`):**
- Purpose: decorators, metadata, types, route matching/precompilation, the request
  pipeline, middleware execution, errors, rate limiting, fingerprinting, RBAC, logging,
  WebSocket/SSE services.
- Location: `src/core/src/`
- Public subpaths: `@heliosjs/core`, `/utils`, `/types`, `/constants` (declared in
  `src/core/package.json` `exports`, mirrored in `vitest.config.ts` aliases).
- Depends on: `reflect-metadata`, `class-validator`, `class-transformer`, `joi`, `ws`.
- Used by: every other package.

**HTTP (`@heliosjs/http`):**
- Purpose: `node:http` runtime, request/response factories, static file serving, plugin
  system, optional WebSocket / SSE / GraphQL servers.
- Location: `src/http/src/`; entry `src/http/src/Helios.ts`.
- Depends on: `@heliosjs/core`, optional peer deps `type-graphql` + `graphql-yoga` + `graphql-ws`.

**AWS (`@heliosjs/aws`):**
- Purpose: Lambda adapter. Normalizes API Gateway REST, HTTP API, and Function URL events
  into the core `Request`; formats core `Response` back to a Lambda result.
- Location: `src/aws/src/`; entry `src/aws/src/lambda.ts` (exposes `app.handler`).
- Depends on: `@heliosjs/core`, `aws-lambda` (types).

**gRPC (`@heliosjs/grpc`):**
- Purpose: `GrpcServer` / `GrpcClient` over `@grpc/grpc-js`, rxjs observables for streams.
  Mostly separate from the HTTP pipeline; imports `Logger` + types from core but does not
  declare core as a peer dependency.
- Location: `src/grpc/src/`; entries `server.ts`, `client.ts`.

**Middlewares (`@heliosjs/middlewares`):**
- Purpose: the decorators `@Use`, `@Guard`, `@Pipe`, `@Intercept`, `@Catch`, `@Cors`,
  `@Status`, `@Roles`, `@Sanitize`. Each only pushes a tagged `MiddlewaresMetadataItem`
  via `defineMiddlewaresMeta`. No runtime logic.
- Location: `src/middlewares/src/`.
- Depends on: `@heliosjs/core`.

## Data Flow

**Controller compilation (constructor time):**

1. `@Controller` returns a subclass (`src/core/src/Controller.ts`). Its constructor calls
   `CONTROLLER_LOOKUP_WS` / `CONTROLLER_LOOKUP_SSE`, then `CONTROLLER_META(parentMeta)`.
2. `descriptors/meta.ts`: joins parent prefix with own prefix, prepends parent
   `functions` (this is how class/parent middleware is inherited), calls `collectRoutes`,
   then recursively builds sub-controllers from `config.controllers` as `children`.
3. `collectRoutes` (`src/core/src/utils/core/controller.ts`): for each decorated method,
   merges route middlewares, computes `compiledRegex` (`compileRouteRegex`), `specificity`
   (`routeSpecificity` from `match.ts`), `compiledParamExtractor` (`buildParamExtractor`
   in `helper.ts`), and `compiled` middleware buckets (`buildCompiledMiddleware`).
4. Result stored on `this[CONTROLLER_PRECOMPILED]` (a `ControllerMeta` with `routes` and
   `children`).

**HTTP request** (`Helios.requestHandler` in `src/http/src/Helios.ts`):

1. `RequestFactory.create(req, bodyLimit)` + `ResponseFactory.create(res, request)`.
2. Plugin hook `beforeRequest`.
3. Global CORS (`config.cors`, via `handleCORS`).
4. `this.beforeRequest`: config `sanitizers`, then static middlewares, then config
   middlewares (`this.middlewares`), then global middlewares (`this.globalMiddlewares`,
   populated by `app.use()`).
5. Plugin hook `beforeRoute`.
6. `runController`: iterates `rootControllers`, calling `controller[CONTROLLER_REQUEST]`
   until one returns truthy.
7. `sendResponse`: sets `Content-Type` and `X-Response-Time`, writes body, then plugin
   hook `afterResponse`.

**Per-route pipeline** (`descriptors/request.ts` -> `execute` in
`src/core/src/utils/core/controller.ts`):

1. `matchRoutes` (`src/core/src/utils/core/match.ts`) walks the controller + `children`
   depth-first and returns the **highest-specificity** matching route. Specificity key
   per segment: static `4` > `:param(regex)` `3` > `:param` `2` > optional `?` `1` >
   wildcard `*` `0`, plus a trailing `5`; ties keep the first-declared route.
   *(Note: CLAUDE.md still says "no specificity ranking / a wildcard shadows `/users`" —
   that is stale as of commit `4957052` / this refactor.)*
2. Param extraction (`compiledParamExtractor` or `getParams`).
3. Route-level CORS configs (reduced over `route.compiled.cors`).
4. `beforeRequest`:
   a. `enforceRateLimit` (`utils/core/ratelimit/enforce.ts`; last `rateLimit` item wins).
   b. sanitizers
   c. guards (`runGuard` — supports guard instance, guard class, guard function; a
      returned string becomes the forbidden message).
   d. pipes (`body` / `query` / `params` / `headers` transforms).
   e. middlewares (`mw(req, res, NextFunction)`).
5. Body/multipart resolution; per-parameter resolution with `class-validator` /
   `joi` validation for `body`, `query`, `params`, `headers`, `cookies`, `multipart`
   (`TO_VALIDATE` in `constants.ts`). Special param types: `ws`, `sse`, `request`,
   `response`, `fingerprint`.
6. Handler (`route.fn(...args)`).
7. Response status (`route.compiled.status` -> `@Status` -> `200`), then interceptors
   applied in **reverse** order.
8. On throw: error handlers newest-first (`runErrorHandlers`). Errors whose `code` is
   `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, or `UNAUTHORIZED`
   (`SKIP_ERROR_HANDLER_CODES`) resolve to their own HTTP response and skip handlers
   **only when the route declares no handler**; an explicit `@Catch` receives them.

**Lambda request** (`src/aws/src/lambda.ts`):

1. Plugin hook `beforeRequest`. `getEventType` detects REST / HTTP API / Function URL.
2. `RequestFactory.create(event, context)` -> core `Request`; `ResponseFactory.create`.
3. `controller[CONTROLLER_REQUEST](request, response)` (same compiled pipeline as HTTP).
4. Response converted to a Lambda result (`utils/aws/response.factory.ts`).

**gRPC request** (`src/grpc/src/server.ts`): loads protos, registers `@GrpcService` /
`@GrpcMethod` handlers, adapts observable / promise / sync results and unary / streaming
calls. Independent of the HTTP `execute` pipeline.

**State Management:** Core owns process-global singletons that adapters configure at
startup: `setRolesExtractor`, `setFingerprintConfig`, `setRateLimitConfig`,
`setGlobalLogger` / `getGlobalLogger`, `WebSocketService.getInstance()`,
`SSEService.getInstance()`. Rate-limit counters live in a pluggable store
(`utils/core/ratelimit/store.ts`, in-memory by default).

## Key Abstractions

**Controller:**
- Purpose: a class of route handlers plus its compiled route table.
- Examples: `src/core/src/Controller.ts`, `src/core/src/descriptors/meta.ts`.
- Pattern: class decorator returns a subclass; compilation in constructor; symbol-keyed
  methods (`CONTROLLER_REQUEST`, `CONTROLLER_META`, `CONTROLLER_PRECOMPILED`, WS/SSE
  lookups) from `src/core/src/descriptors/`.

**Route (compiled):**
- Purpose: one executable endpoint.
- Shape: `src/core/src/types/core/controller.ts` `interface Route` — `compiledRegex`,
  `specificity`, `compiledParamExtractor`, `compiled: CompiledMiddleware`, plus raw
  `functions` for the fallback path.

**MiddlewaresMetadataItem / CompiledMiddleware:**
- Purpose: a tagged middleware record and its bucketed form.
- Tags: `middleware`, `guard`, `pipe`, `sanitizer`, `interceptor`, `errorHandler`,
  `cors`, `rateLimit`, `status` (`src/core/src/types/core/controller.ts`).

**Plugin:**
- Purpose: transport lifecycle hooks (`beforeRequest`, `beforeRoute`, `afterResponse`,
  `onStart`, `onStop`).
- Examples: `src/http/src/utils/http/plugin.ts`, `src/aws/src/utils/aws/plugin.ts`.

**Transport adapter:**
- Purpose: normalize a platform request/response to/from the core `Request` / `Response`.
- Examples: `src/http/src/Helios.ts`, `src/aws/src/lambda.ts`, `src/grpc/src/server.ts`.

**Logger:**
- Purpose: leveled, colorized console logger with context / child loggers and a global
  singleton.
- Location: `src/core/src/utils/core/logger.ts`, types in
  `src/core/src/types/core/logger.ts`. Exported from `@heliosjs/core` and
  `@heliosjs/core/utils`.
- Levels: `silent` < `fatal` < `error` < `warn` < `log` < `debug` < `verbose`.
  `Helios` builds one from `config.log` (`@Server` decorator); `config.log === false`
  sets level `silent`.

## Entry Points

**HTTP Server:**
- Location: `src/http/src/Helios.ts`
- Triggers: `new Helios(AppModule)` then `app.listen(port?, host?)`.
- Responsibilities: `resolveConfig` from `@Server` / `@Port` decorators
  (`SERVER_CONFIG_KEY`), compile root controllers, wire static/config/global middleware
  and plugins, create `http.Server`, optionally set up WebSocket / SSE / (on `listen`)
  GraphQL. WebSocket and GraphQL cannot both be enabled.

**Lambda Handler:**
- Location: `src/aws/src/lambda.ts`
- Triggers: AWS Lambda invocation of `app.handler`.

**gRPC Server:**
- Location: `src/grpc/src/server.ts`
- Triggers: `new GrpcServer(...)` then `server.start()`.

## Error Handling

**Strategy:** custom error classes extending `ApplicationError`
(`src/core/src/utils/core/error/apperror.ts`), each carrying an HTTP `status` and a
`code` (`ErrorCode` enum). `base.ts` and typed subclasses: `NotFoundError`,
`ValidationError`, `ForbiddenError`, `UnauthorizedError`, `RateLimitExceededError`,
`DuplicateEntryError`, `PayloadTooLargeError`, `ServiceUnavailableError`,
`InvalidStateError`, `DependencyFailedError`, `InternalError`.

**Patterns:**
- `getErrorType` / helpers in `utils/core/error/helpers.ts` classify thrown values.
- `runErrorHandlers` runs `@Catch` handlers newest-first; the first that returns a
  non-`Error` becomes `response.data`.
- `SKIP_ERROR_HANDLER_CODES` short-circuit to a native HTTP response when no handler is
  declared (see pipeline step 8).
- Stack traces are included only outside production.

## Cross-Cutting Concerns

**Logging:** `Logger` (`utils/core/logger.ts`) + global singleton. Startup banner and
config summary logged by `Helios.logConfig`. gRPC imports the same `Logger`.
**Validation:** `class-validator` + `class-transformer` for DTO classes, `joi` for
schema objects, dispatched by `utils/shared/validate.ts` for the six `TO_VALIDATE`
param sources.
**Authentication:** none built in. RBAC via a user-supplied roles extractor
(`setRolesExtractor`) consumed by `@Roles` / `utils/core/rbac.ts`.
**CORS:** `handleCORS` (`utils/core/cors.ts`), applied globally by adapters and
per-route via `@Cors`.
**Rate limiting:** `utils/core/ratelimit/` — `enforce.ts`, pluggable `store.ts`,
`strategies.ts` (token bucket / fixed / sliding), global config via `setRateLimitConfig`,
per-route via `@RateLimit`.
**Fingerprinting:** `utils/core/fingerprint.ts` (`getOrComputeFingerprint`), configured
by `setFingerprintConfig`; default rate-limit key and `@Fingerprint` param source.

---

*Architecture analysis: 2026-09-10*
