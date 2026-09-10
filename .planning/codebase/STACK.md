# Technology Stack

**Analysis Date:** 2026-09-10

## Languages

**Primary:**
- TypeScript 6.0.2 - All package sources under `src/<pkg>/src/`, decorators, type defs. Legacy decorators (`experimentalDecorators` + `emitDecoratorMetadata`) in root `tsconfig.json`.

**Secondary:**
- JavaScript (ESM) - Config only: `eslint.config.js`, `nodemon.json` targets, `setup-symlinks.sh` is shell.
- TSX/React 19 - `helios-docs/` Docusaurus site (separate workspace, `docs` package).

## Runtime

**Environment:**
- Node.js >=20.0.0 (`engines.node` in root and every `src/<pkg>/package.json` peer). CI (`.github/workflows/*.yml`) runs Node 24.
- ESM-only (`"type": "module"` everywhere), `moduleResolution: nodenext`, `target: es2022`.

**Package Manager:**
- Yarn 1.22.22 Classic (`packageManager` field; CI uses `corepack enable`).
- Workspaces: `src/core`, `src/middlewares`, `src/http`, `src/aws`, `src/grpc`, `helios-docs`.
- Lockfile: `yarn.lock` present, CI installs with `--frozen-lockfile`.

## Frameworks

**Core:**
- Custom decorator framework - no external HTTP framework. `@heliosjs/http` wraps `node:http` directly (`src/http/src/Helios.ts`); `@heliosjs/aws` wraps Lambda events (`src/aws/src/lambda.ts`).
- Published package versions: `@heliosjs/core` 3.2.9, `@heliosjs/http` 10.0.6, `@heliosjs/aws` 10.0.5, `@heliosjs/middlewares` 10.0.5, `@heliosjs/grpc` 2.1.13. `http`/`aws`/`middlewares` are version-linked via Changesets; `core` and `grpc` version independently.

**Testing:**
- Vitest ^4.1.9 - runner, `environment: node`, config in `vitest.config.ts`, setup `vitest.setup.ts` (imports `reflect-metadata`).
- `@vitest/coverage-v8` ^4 - V8 coverage. Thresholds: lines 96, functions 96, statements 95, branches 88.
- Vitest transforms decorators via `oxc: { decoratorLegacy: true }` (not tsc, not Babel).
- Tests alias `@heliosjs/*` to package source (not `dist`) - see `resolve.alias` in `vitest.config.ts`.

**Build/Dev:**
- TypeScript `tsc` per package via `tsconfig.build.json` (each just extends the package `tsconfig.json` + sets `outDir`). Build order is strict: core -> http -> aws -> middlewares -> grpc (`yarn build`).
- Use `yarn build` as the typecheck; `tsc` on root `tsconfig.json` has pre-existing errors.
- Nodemon 3.1.14 - `yarn dev` via `nodemon.json`.
- ESLint 10.3.0 + typescript-eslint 8.59.1 - flat config `eslint.config.js`, type-aware (`projectService: true`). `eslint-config-prettier` 10.1.8 is installed but not wired into the config. `eslint-plugin-unused-imports` 4.4.1.
- Prettier - `.prettierrc` (100 cols, single quotes, `trailingComma: es5`, 2-space). No prettier in scripts; formatting relied on via editor/eslint.
- Changesets `@changesets/cli` 2.30.0 - versioning + `changeset publish --provenance`.
- autocannon ^7.15.0 - `yarn benchmark` (`benchmarks/run.ts`) compiles with `tsc --skipLibCheck` then runs Helios vs Express ^4.21 vs Fastify ^5.1 (both dev-only).
- Docusaurus 3.10.2 (`@docusaurus/preset-classic`, `@docusaurus/faster`) - `helios-docs/`.

## Key Dependencies

**Critical (runtime, per package):**
- `reflect-metadata` ^0.2.2 - decorator metadata store; peer dep of every package, `middlewares` also lists it as a direct dependency. Entry points must import it.
- `class-validator` ^0.15.1 + `class-transformer` ^0.5.1 - DTO validation/transformation for `body`/`query`/`params`/`headers`/`cookies`/`multipart`. Direct deps of `@heliosjs/core`.
- `joi` ^18.0.2 - alternative schema validation path. Direct dep of `@heliosjs/core`.
- `parse-multipart-data` ^1.5.0 - multipart form parsing (`src/core/src/utils/core/multipart.ts`). Direct dep of `@heliosjs/core`.
- `ws` ^8.19.0 - WebSocket server/client. Direct dep of `@heliosjs/core`; peer of `http` and `aws`.
- `@grpc/grpc-js` ^1.14.3 - gRPC transport. Direct dep of `@heliosjs/grpc` (and a root dependency + resolution).
- `@grpc/proto-loader` ^0.8.0 - proto parsing, used directly in `src/grpc/src/server.ts` and `src/grpc/src/client.ts` but NOT declared in `src/grpc/package.json`; resolves only as a transitive dep of `@grpc/grpc-js`.
- `rxjs` ^7.8.2 - observables for gRPC streaming. Direct dep of `@heliosjs/grpc` + root.
- `type-graphql` ^2.0.0-rc.3 - only declared runtime dep of `@heliosjs/http`; loaded via dynamic `import()` in `Helios.ts` alongside `graphql-yoga` / `graphql-ws`.
- `aws-lambda` ^1.0.7 - event/context types for `@heliosjs/aws`.

**Optional / peer-style (needed only when a feature is enabled):**
- `graphql-yoga` 5.18.1, `graphql-ws` 6.0.7, `graphql` 16.13.1, `graphql-scalars` 1.25.0 - GraphQL. Present only as root devDependencies; dynamically imported in `src/http/src/Helios.ts` (~line 429). Consumers must install these to use GraphQL. WebSocket and GraphQL cannot be enabled together.

**Standard library only:**
- `node:http`, `node:crypto` (`createHash`/`createHmac` for request fingerprint in `src/core/src/utils/core/fingerprint.ts`), `node:url`, `node:path`.

## Configuration

**Environment (runtime):**
- `NODE_ENV` - `!== 'production'` toggles stack traces in error responses (`src/core/src/utils/core/response.ts`, `src/core/src/utils/core/error/apperror.ts`, `src/aws/src/lambda.ts`).
- `LOG_ERRORS` - any truthy value enables error logging in responses.
- No runtime env validation; only these two vars are read in package source.
- Server behavior is configured through decorators (`@Server`, `@Port`) and core setters (`setRolesExtractor`, `setFingerprintConfig`, `setRateLimitConfig`, `setGlobalLogger`), not env.

**Build:**
- Root `tsconfig.json` - ES2022, `nodenext`, `strict`, `experimentalDecorators`, `emitDecoratorMetadata`, `strictPropertyInitialization: false`, `preserveSymlinks`.
- `src/<pkg>/tsconfig.json` + `src/<pkg>/tsconfig.build.json` per package.
- `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `benchmarks/tsconfig.json`.
- Package public subpaths declared in `src/core/package.json` `exports`: `.`, `./utils`, `./types`, `./constants` - adding one means updating that plus the vitest aliases.

## Platform Requirements

**Development:**
- Node.js >=20, Yarn 1.x.
- `yarn test` (~3s) and `yarn build` are the working gates. `yarn lint` and `yarn test:coverage` currently fail on clean master (see project memory).

**Production:**
- Published to npm as public `@heliosjs/*` scoped packages via `.github/workflows/publish.yml` (Release) on push to `master`/`main`: `yarn install --frozen-lockfile` -> `yarn build` -> `yarn release` (`changeset publish --provenance --access public`). No changeset "Version Packages" PR step - versions must be bumped before merge.
- Docs deployed to GitHub Pages via `.github/workflows/docs.yml` on changes under `helios-docs/**`.
- Consumer runtime targets: `node:http` server, AWS Lambda (API Gateway REST v1 / HTTP API v2 / ALB / Function URL), gRPC server/client.

---

*Stack analysis: 2026-09-10*
