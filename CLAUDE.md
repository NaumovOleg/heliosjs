# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

HeliosJS is a decorator-based Node.js API framework published as five npm packages from one Yarn 1.x workspace monorepo. It needs Node 20 or newer (each package's `package.json` declares `engines.node`). Source is written with ESM `import`/`export` syntax, but none of the five package.json files set `"type": "module"`, so `tsc`'s `nodenext` mode compiles `dist/` to CommonJS — the published packages are CJS under the hood, reachable via both `require` and `import` through the dual `exports` map. Don't assume ESM-only when touching build/publish config.

## Commands

```bash
yarn test                 # vitest run (whole suite, ~3s)
yarn vitest run __tests__/core/unit/decorators/endpoint.test.ts   # single file
yarn vitest run -t "matches wildcard"                             # single test by name
yarn test:coverage        # enforces thresholds: lines 96, functions 96, statements 95, branches 88
yarn lint                 # eslint --fix over the repo (type-aware, uses projectService)
yarn build                # tsc per package, strict order: core → http → aws → middlewares → grpc
yarn build:core           # one package (also build:http, build:aws, build:middlewares, build:grpc)
yarn benchmark            # autocannon: Helios vs Express vs Fastify (benchmarks/run.ts)
yarn docs:start           # Docusaurus site in helios-docs/
```

Use `yarn build` as the typecheck. Running `tsc` against the root `tsconfig.json` shows pre-existing errors, so that result isn't useful.

## Layout

- `src/<pkg>/src/`: package sources. Every package follows the same shape: `index.ts`, `types/<pkg>/`, and `utils/<pkg>/`.
- `__tests__/<pkg>/`: all tests are here, never inside the packages. Some live in `unit/` or `e2e/` and some sit flat in `__tests__/<pkg>/`. Shared factories are in `__tests__/helpers/http.ts` (`makeRequest`, `makeResponse`, `makeRoute`, `makeControllerMeta`).
- Tests import `@heliosjs/*` directly from **source**, not from `dist`. The aliases are in `vitest.config.ts`, so you don't need to build before testing. `vitest.setup.ts` imports `reflect-metadata`.
- `vitest.config.ts` has no test-file exclusions — every `__tests__/**/*.test.ts` runs (the three that were once excluded, `grpc/unit/server-extended`, `http/unit/factories`, `core/unit/socket/server`, were re-enabled once their underlying bugs were fixed). It does exclude several files from *coverage* measurement (the socket/sse servers, most of grpc) — check `coverage.exclude` before concluding a file is covered just because its tests pass.
- `__tests__/tsconfig.json` gives ESLint's `projectService` a project for test files (the root `tsconfig.json` only includes `src/**`), so type-aware lint rules actually run on `__tests__` too, not just `src/**`.
- `helios-docs/`: the Docusaurus docs workspace. `helios-docs/docs/` is gitignored.
- `.planning/codebase/*.md`: earlier analysis notes. Some of them are stale, for example the coverage numbers in CONCERNS.md.

## Architecture

**Decorators write metadata, and compilation happens in the constructor.** All decorators use `Reflect.defineMetadata`, with keys from `src/core/src/constants.ts`:
- `DECORATOR.controller` stores the controller config.
- `DECORATOR.route` is set per method and stores the HTTP method, path, param decorators, and route middlewares.
- `DECORATOR.middlewares` is set per class or per method and holds a list of `MiddlewaresMetadataItem`.

Each item in that list is a tagged object with one of these keys: `middleware`, `guard`, `pipe`, `sanitizer`, `interceptor`, `errorHandler`, `cors`, `rateLimit`, or `status`. The decorators in `@heliosjs/middlewares` (`@Use`, `@Guard`, `@Pipe`, `@Intercept`, `@Catch`, `@Cors`, `@Status`, `@Roles`, `@Sanitize`) only push these items through `defineMiddlewaresMeta`. They contain no runtime logic of their own.

**How `@Controller` works** (`src/core/src/Controller.ts`):
- It returns a subclass, and attaches symbol-keyed methods from `src/core/src/descriptors/`: `CONTROLLER_REQUEST`, `CONTROLLER_META`, and the WS/SSE lookups.
- When the subclass is constructed with a parent meta object, it calls `CONTROLLER_META` (`descriptors/meta.ts`). That call:
  - joins the parent prefix with its own prefix,
  - prepends the parent's `functions` to its own (this is how middlewares are inherited),
  - calls `collectRoutes`, and
  - recursively builds sub-controllers from `config.controllers` as `children`.

  The result is stored as `this[CONTROLLER_PRECOMPILED]`.
- `collectRoutes` (`src/core/src/utils/core/controller.ts`) precompiles each route: a regex, a param extractor, and a `compiled` bucket that `buildCompiledMiddleware` splits by kind.

**Request pipeline** (`execute` and `beforeRequest` in `utils/core/controller.ts`) runs in this order:
1. `matchRoutes` walks the whole controller tree depth-first and keeps the highest-specificity match. `routeSpecificity` (`utils/core/match.ts`) ranks per segment: static > `:param(regex)` > `:param` > optional (`?`) > wildcard (`*`), compared left to right, with a trailing marker so a shorter exact path beats a longer optional/wildcard one. Ties keep the first-declared route, so a wildcard no longer shadows a sibling `/users`.
2. CORS
3. Rate limit
4. Sanitizers
5. Guards
6. Pipes
7. Middlewares
8. Param resolution, with class-validator/joi validation for `body`, `query`, `params`, `headers`, `cookies`, and `multipart`
9. The handler
10. Interceptors, applied in reverse order
11. Error handlers on throw

Errors whose `code` is FORBIDDEN, NOT_FOUND, RATE_LIMIT_EXCEEDED, or UNAUTHORIZED resolve to their own HTTP response and skip the error handlers **only when the route declares no `@Catch`** (`SKIP_ERROR_HANDLER_CODES` in `utils/core/controller.ts`); an explicit `@Catch` handler receives them like any other error. `execute` also has an uncompiled fallback path (`route.compiled` absent). Keep both branches consistent when you change behavior.

**Transport adapters** all dispatch to the same compiled controllers through `controller[CONTROLLER_REQUEST](req, res)`:
- `@heliosjs/http`: `Helios` (`src/http/src/Helios.ts`) wraps `node:http`. Its request order is:
  1. plugin `beforeRequest`
  2. global CORS
  3. static middlewares
  4. config middlewares
  5. global middlewares
  6. plugin `beforeRoute`
  7. root controllers
  8. `sendResponse`

  Config comes from the `@Server` / `@Port` class decorators under `SERVER_CONFIG_KEY`. The WebSocket/SSE servers and GraphQL (type-graphql + graphql-yoga) are optional, and WebSocket and GraphQL can't be enabled together.
- `@heliosjs/aws`: `Helios` in `src/aws/src/lambda.ts` exposes `app.handler`. It normalizes REST, HTTP API, and function URL events into the core `Request`.
- `@heliosjs/grpc`: `GrpcServer` / `GrpcClient` over `@grpc/grpc-js`, with rxjs observables for streams. This is mostly separate from the HTTP pipeline. It imports `Logger` and types from core, and declares `@heliosjs/core` as a peer dependency.

Core also owns cross-cutting singletons that adapters configure: `setRolesExtractor`, `setFingerprintConfig`, `setRateLimitConfig`, `setGlobalLogger`, and `WebSocketService.getInstance()` / `SSEService.getInstance()`.

## Conventions

- Decorators are legacy (`experimentalDecorators` + `emitDecoratorMetadata`), not TC39. Vitest uses `oxc.decoratorLegacy`. Entry points must import `reflect-metadata`.
- Imports between packages go through the public subpaths `@heliosjs/core`, `@heliosjs/core/utils`, `@heliosjs/core/types`, and `@heliosjs/core/constants`. Adding a subpath means updating the `exports` in `src/core/package.json`, the vitest aliases, and anything else that resolves the name.
- Lint rules that tend to fail: `consistent-type-imports` (use `import type`), `no-floating-promises`, `unused-imports/no-unused-imports`. Unused vars must be prefixed with `_`.
- Prettier settings: 100 columns, single quotes, `trailingComma: es5`.
- Naming: PascalCase files for classes (`Controller.ts`) and camelCase for utilities. Interfaces are prefixed with `I` (`IController`). Custom errors extend `ApplicationError` in `src/core/src/utils/core/error/` and carry an HTTP `status`.
- Commit messages use conventional style: `fix(scope): …`, `feat(scope): …`, `chore(scope)`.

## Releasing

Releases use Changesets. `http`, `aws`, and `middlewares` are version-linked, while `core` and `grpc` are versioned independently. Run `yarn changeset` to record a change. A push to `master` runs `.github/workflows/publish.yml`, which does `yarn build`, `yarn test:coverage`, and then `changeset publish`.

For what counts as a breaking change, support windows, and which surfaces (if any) are exempt from semver — not release mechanics, the actual guarantees — see `STABILITY.md`.
