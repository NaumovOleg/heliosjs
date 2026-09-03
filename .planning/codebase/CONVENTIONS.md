# Coding Conventions

**Analysis Date:** 2026-09-03

## Naming Patterns

**Files:**
- PascalCase for class-defining files: `Controller.ts`, `Helios.ts`
- camelCase for utility files: `match.ts`, `controller.ts`
- `index.ts` for barrel exports
- Test files: `<feature>.test.ts` (kebab-case)

**Functions:**
- camelCase: `matchRoutes`, `handleCORS`, `createHandler`
- Verbs for actions: `compileControllers`, `runController`, `sendResponse`

**Variables:**
- camelCase: `routePrefix`, `controllerMeta`
- UPPER_SNAKE_CASE for constants: `CONTROLLER_REQUEST`, `SERVER_CONFIG_KEY`

**Types:**
- PascalCase with descriptive suffixes: `ControllerClass`, `ControllerMeta`, `ServerConfig`
- Interfaces: `IController`, `IHttpServer`, `ILambdaAdapter`
- Type aliases: `MiddlewareCB`, `ControllerType`

## Code Style

**Formatting:**
- Prettier (`.prettierrc`)
- Single quotes, trailing commas (es5), 100 char width
- 2-space indentation, no tabs
- Semicolons required

**Linting:**
- ESLint 10.x with flat config
- `@typescript-eslint/strict` + `stylistic` presets
- Key rules:
  - `consistent-type-imports: error`
  - `no-floating-promises: error`
  - `unused-imports/no-unused-imports: error`
  - `no-console: warn`

## Import Organization

**Order:**
1. Node.js builtins (`node:http`, `node:path`)
2. External packages (`@grpc/grpc-js`, `rxjs`, `reflect-metadata`)
3. Internal packages (`@heliosjs/core/...`)
4. Relative imports (`./types`, `./utils`)

**Path Aliases:**
- `@heliosjs/core` → `src/core/src/index.ts`
- `@heliosjs/core/utils` → `src/core/src/utils/index.ts`
- `@heliosjs/core/types` → `src/core/src/types/index.ts`
- `@heliosjs/core/constants` → `src/core/src/constants.ts`
- `@heliosjs/middlewares` → `src/middlewares/src/index.ts`

## Error Handling

**Patterns:**
- Custom error classes extending `ApplicationError`
- Errors include `status` code and `message`
- Stack traces conditional on `NODE_ENV !== 'production'`
- Controller methods catch and serialize via `response.error()`

**Error Classes:**
- `NotFoundError` (404)
- `ValidationError` (400)
- `ForbiddenError` (403)
- `UnauthorizedError` (401)
- `PayloadTooLargeError` (413)
- `RateLimitExceededError` (429)

## Logging

**Framework:** `console` (no structured logging)

**Patterns:**
- Server startup: Box-formatted banner with emoji
- gRPC startup: `console.log` with port
- Errors: Serialized via `ApplicationError` with optional `LOG_ERRORS`

## Comments

**When to Comment:**
- JSDoc on public APIs (decorators, classes, methods)
- Implementation notes for complex logic
- `eslint-disable` comments with reasons

**JSDoc/TSDoc:**
- All exported decorators have full JSDoc with `@param`, `@example`, `@remarks`
- Classes have description and `@example`
- Methods have `@param`, `@returns`, `@example`

## Function Design

**Size:** Moderate - 20-100 lines typical; Helios.requestHandler is 40 lines
**Parameters:** Descriptive names; config objects for complex options
**Return Values:** Explicit returns; Promises for async operations

## Module Design

**Exports:**
- Barrel files (`index.ts`) re-export public API
- Named exports preferred over default exports
- Selective exports in `src/core/src/index.ts` (specific types/utils)

**Barrel Files:**
- Every package has `src/index.ts`
- Core exports split across `index.ts`, `utils/index.ts`, `types/index.ts`

---

*Convention analysis: 2026-09-03*
