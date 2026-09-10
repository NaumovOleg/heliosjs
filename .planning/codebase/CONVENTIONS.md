# Coding Conventions

**Analysis Date:** 2026-09-10

## Naming Patterns

**Files:**
- PascalCase for files whose main export is a class: `src/core/src/Controller.ts`, `src/core/src/Endpoint.ts`, `src/http/src/Helios.ts`
- camelCase for utilities and everything else: `src/core/src/utils/core/match.ts`, `src/core/src/utils/core/controller.ts`, `src/aws/src/lambda.ts`
- `index.ts` for barrel exports at every package root and inside `utils/`, `types/`, `decorators/`
- Error classes live one-per-file, lowercased: `src/core/src/utils/core/error/notfound.ts`, `authorizations.ts`, `payloadTooLarge.ts`, `apperror.ts`
- Test files: `<feature>.test.ts`, kebab-case (`ratelimit-fixed-window.test.ts`, `lambda-adapter.test.ts`)

**Functions:**
- camelCase, verb-first for actions: `matchRoutes`, `collectRoutes`, `buildCompiledMiddleware`, `defineMiddlewaresMeta`, `enforceRateLimit`, `computeFingerprint`
- Getter/setter singleton pairs: `getRolesExtractor` / `setRolesExtractor`, `getGlobalLogger` / `setGlobalLogger`, `getRateLimitConfig` / `setRateLimitConfig`
- Decorators are PascalCase functions returning a decorator: `Controller`, `Get`, `Guard`, `Use`, `Catch`, `Cors`, `Status`, `Roles`, `Sanitize`

**Variables:**
- camelCase for locals and config (`routePrefix`, `controllerMeta`, `portCounter`)
- UPPER_SNAKE_CASE for module-level constants and metadata keys in `src/core/src/constants.ts` (`SERVER_CONFIG_KEY`, `ROUTE_MIDDLEWARES`, `TO_VALIDATE`, `OK_STATUSES`)
- Symbol-keyed descriptor slots: `CONTROLLER_REQUEST`, `CONTROLLER_META`, `CONTROLLER_PRECOMPILED` (from `src/core/src/descriptors/`)
- `DECORATOR` is a string enum (not consts) in `constants.ts`: `DECORATOR.controller | .middlewares | .route`

**Types:**
- PascalCase; `I`-prefix for interfaces (`IController`, `IWebSocketServer`, `IWebSocketService`, `ISSEService`)
- Callback type aliases carry a `CB` suffix: `MiddlewareCB`, `InterceptorCB`
- `*Class` / `*Function` / `*Instance` triads for decorator inputs (`GuardClass`, `GuardFunction`, `GuardInstance`)
- Config objects suffixed `Config` (`ServerConfig`, `RateLimitConfig`, `FingerprintConfig`, `SanitizerConfig`)
- Unused params/vars must be `_`-prefixed (enforced by lint)

## Code Style

**Formatting:**
- Prettier, config in `.prettierrc` (ignore list in `.prettierignore`)
- `printWidth: 100`, `tabWidth: 2`, `useTabs: false`, `semi: true`, `singleQuote: true`, `quoteProps: "as-needed"`, `trailingComma: "es5"`, `bracketSpacing: true`, `arrowParens: "always"`, `endOfLine: "lf"`
- Source under `src/**` is consistent. Some `__tests__/**` files drift to double quotes (9 files, including the recently edited `__tests__/core/match.test.ts` and `__tests__/helpers/http.ts`) — match the surrounding file, but new test files should use single quotes.

**Linting:**
- ESLint `10.3.0` + `typescript-eslint` `8.59.1`, flat config in `eslint.config.js` via `defineConfig([...])`
- Presets: `eslint.configs.recommended`, `tseslint.configs.strict`, `tseslint.configs.stylistic`
- Type-aware: `parserOptions.projectService: true`, `tsconfigRootDir: import.meta.dirname`
- Explicit rules:
  - `@typescript-eslint/consistent-type-imports: error` — use `import type`
  - `@typescript-eslint/no-floating-promises: error`
  - `unused-imports/no-unused-imports: error`
  - `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern`/`varsIgnorePattern` `^_`
  - `@typescript-eslint/no-extraneous-class: off` (decorator marker classes)
  - `no-console: warn` (off for `*.config.*` and `benchmarks/**`)
- Ignored: `node_modules`, `dist`, `build`, `coverage`, `**/*.config.js`, `**/vitest.config.ts`, `**/vitest.setup.ts`, `**/temp-*/**`
- `yarn lint` runs `npx eslint --fix`. **It currently fails on a clean `master`** (pre-existing violations) — see `.claude .../memory/MEMORY.md`. Use `yarn build` (tsc per package) as the typecheck gate and `yarn test` as the behavior gate.

## Import Organization

**Order (observed, not lint-enforced):**
1. `reflect-metadata` side-effect import first in entry points and test files
2. Node builtins (`node:http`, `node:path`, `node:url`)
3. External packages (`@grpc/grpc-js`, `rxjs`, `class-validator`, `vitest`)
4. Cross-package `@heliosjs/*` subpath imports
5. Relative imports (`./types`, `../utils`)
- `import type` for type-only imports (lint-enforced). Mixed inline form also appears: `import { type GuardClass } from '@heliosjs/core/types'`

**Path Aliases / subpaths:**
- Public package subpaths: `@heliosjs/core`, `@heliosjs/core/utils`, `@heliosjs/core/types`, `@heliosjs/core/constants`, plus `@heliosjs/http`, `@heliosjs/aws`, `@heliosjs/grpc`, `@heliosjs/middlewares`
- Declared in three places that must stay in sync: `exports` in `src/core/src` package's `package.json`, the `resolve.alias` list in `vitest.config.ts`, and any tsconfig path setup
- Tests import from source via those aliases; a subset instead reach in relatively (`../../../src/aws/src/lambda`) — both work under vitest, alias form preferred

## Error Handling

**Patterns:**
- `BaseError extends Error implements HeliosError` in `src/core/src/utils/core/error/base.ts` — carries `code` (`ErrorCode` enum from `src/core/src/types/core/error.ts`), `status`, `details`, `timestamp`, `requestId`, `path`, `method`; `getDefaultStatus(code)` maps code→HTTP status; `toResponse()` returns `{ success:false, error:{...} }`
- Concrete subclasses extend `BaseError` and set `this.name`: `NotFoundError` (404), `ValidationError` (400), `ForbiddenError` (403), `UnauthorizedError` (401), `PayloadTooLargeError` (413), `RateLimitExceededError` (429), `InternalServerError` (500), `ServiceUnavailableError` (503), `DuplicateEntryError`, `DependencyFailedError`, `InvalidStateError` — all in `src/core/src/utils/core/error/`
- `ApplicationError` (`src/core/src/utils/core/error/apperror.ts`) is a *wrapper*, not an `Error` subclass: normalizes any thrown `Error`/`ErrorObject` against request meta + `ErrorHandlerConfig`, optionally logs, and exposes `status`/`code`/`message`/`stack`
- `includeStack` defaults to `process.env.NODE_ENV !== 'production'`; `logErrors` defaults `true`
- Request pipeline: errors with code `FORBIDDEN | NOT_FOUND | RATE_LIMIT_EXCEEDED | UNAUTHORIZED` short-circuit to their own HTTP response and skip `@Catch` handlers **only when no `@Catch` is declared** (`SKIP_ERROR_HANDLER_CODES` in `src/core/src/utils/core/controller.ts`)

## Logging

**Framework:** custom `Logger` class in `src/core/src/utils/core/logger.ts` (not raw `console`)
- Levels `silent < fatal < error < warn < log < debug < verbose` via `LOG_LEVEL_PRIORITY`; ANSI color + optional timestamp + `prefix` (default `Helios`) + optional `context`
- Constructor overload: `new Logger(context)` or `new Logger(config, context)`
- Global instance via `getGlobalLogger()` / `setGlobalLogger()`; adapters wire it up
- Startup/shutdown banners are box-drawn multi-line string constants in `src/core/src/constants.ts` (`STOPPED`, etc.)
- `no-console` is a warning, so direct `console.*` still appears; prefer `Logger`

## Comments

**When to Comment:**
- Every exported decorator has a full JSDoc block: description, `@param`, `@returns`, one or more `@example`, and `@remarks` (see `src/middlewares/src/guard.ts`)
- Barrel `index.ts` files carry a short module-level JSDoc
- Inline comments reserved for non-obvious pipeline ordering and metadata-key semantics
- `eslint-disable` lines should state a reason

**JSDoc/TSDoc:**
- Public API (decorators, `Helios`, `GrpcServer`/`GrpcClient`, core singletons) documented with examples
- Internal utils are mostly self-documenting via names, light or no JSDoc

## Function Design

**Size:** small to moderate; utilities 5-40 lines, pipeline functions (`execute`, `beforeRequest` in `utils/core/controller.ts`) longer with explicit ordered steps
**Parameters:** positional for 1-2 args; a single options/config object once it grows (`BaseError` options, `ApplicationError` `{ meta, config, status }`)
**Return Values:** explicit returns; `Promise` for async; `undefined` (not `null`) for "no match" (`matchRoutes`)

## Module Design

**Exports:**
- Named exports only, no default exports
- `src/core/src/index.ts` is a *curated* barrel: `export *` for decorators/constants but an explicit allow-list of type and util names (adding a public symbol means editing this list)
- Sub-barrels: `utils/index.ts`, `types/index.ts`, `decorators/index.ts`

**Barrel Files:**
- One `index.ts` per package as the published entry (`main`/`types` → `dist/index.js`)
- Core additionally splits its surface across `./utils`, `./types`, `./constants` subpath exports

---

*Convention analysis: 2026-09-10*
