# AGENTS.md

## Quick commands

```bash
yarn lint          # eslint --fix (auto-fixes)
yarn test          # vitest run (single pass)
yarn test:watch    # vitest (watch mode)
yarn test:coverage # vitest run --coverage
yarn build         # builds all packages in order: core → http → aws → middlewares → grpc
yarn build:core    # build single package
```

Run a single test file: `yarn vitest run __tests__/core/unit/decorators/endpoint.test.ts`

## Monorepo structure

Yarn 1.x workspaces. Five packages under `src/`:

- `@heliosjs/core` — decorator framework, request/response types, pipeline, validation, rate limiting, error classes
- `@heliosjs/http` — raw `node:http` server, SSE, WebSocket, GraphQL (type-graphql)
- `@heliosjs/aws` — AWS Lambda adapter
- `@heliosjs/middlewares` — CORS, RBAC, fingerprint, guards, pipes, sanitization
- `@heliosjs/grpc` — gRPC server/client via `@grpc/grpc-js`, rxjs observables

Core has no internal deps. Others peer-depend on `@heliosjs/core`. Build order is strict.

## TypeScript

- ESM-first (`"type": "module"`, `module: "nodenext"`)
- `experimentalDecorators` + `emitDecoratorMetadata` enabled — decorators are legacy-style, not TC39
- `reflect-metadata` must be imported at entry points (vitest.setup.ts handles this for tests)
- Path aliases: `@heliosjs/core`, `@heliosjs/core/utils`, `@heliosjs/core/types`, `@heliosjs/core/constants`, `@heliosjs/middlewares`

## Linting rules that bite

- `@typescript-eslint/consistent-type-imports: error` — use `import type { X }` for types
- `@typescript-eslint/no-floating-promises: error` — await or explicitly ignore promises
- `unused-imports/no-unused-imports: error` — no dead imports
- `no-console: warn`

## Testing

- Tests live in `__tests__/` at repo root (not inside packages)
- Test structure: `__tests__/<package>/unit/` and `__tests__/<package>/e2e/`
- Helper factories in `__tests__/helpers/http.ts`: `makeRequest()`, `makeResponse()`, `makeRoute()`, `makeControllerMeta()`
- Coverage thresholds: lines 65%, functions 75%, statements 65%, branches 65%

## Conventions

- PascalCase for class-defining files (`Controller.ts`), camelCase for utilities (`match.ts`)
- UPPER_SNAKE_CASE for constants (`CONTROLLER_REQUEST`)
- Interfaces prefixed with `I` (`IController`, `IHttpServer`)
- Custom errors extend `ApplicationError` with `status` code: `NotFoundError` (404), `ValidationError` (400), `ForbiddenError` (403), `UnauthorizedError` (401), `PayloadTooLargeError` (413), `RateLimitExceededError` (429)

## Publishing

Changesets. `http`, `aws`, `middlewares` are version-linked. `core` and `grpc` version independently.

```bash
yarn changeset        # create changeset
yarn version-packages # bump versions
yarn release          # publish to npm
```
