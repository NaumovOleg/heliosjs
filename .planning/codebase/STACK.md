# Technology Stack

**Analysis Date:** 2026-09-03

## Languages

**Primary:**
- TypeScript 6.0.2 - All source code, decorators, type definitions

**Secondary:**
- JavaScript (ESM) - Config files (`eslint.config.js`, `vitest.config.ts`)

## Runtime

**Environment:**
- Node.js >=20.0.0

**Package Manager:**
- Yarn 1.22.22 (Classic)
- Lockfile: `yarn.lock` present

## Frameworks

**Core:**
- Custom decorator-based framework (`@heliosjs/core`) - No external HTTP framework; uses raw `node:http`

**Testing:**
- Vitest ^4.1.9 - Test runner with V8 coverage
- `@vitest/coverage-v8` - Coverage provider

**Build/Dev:**
- TypeScript 6.0.2 - Compilation via `tsc`
- Nodemon 3.1.14 - Dev server auto-reload
- ESLint 10.3.0 + typescript-eslint 8.59.1 - Linting
- Prettier - Formatting (`.prettierrc`)
- Changesets 2.30.0 - Versioning and publishing

## Key Dependencies

**Critical:**
- `reflect-metadata` 0.2.2 - Decorator metadata (peer dep, required everywhere)
- `class-validator` 0.15.1 + `class-transformer` 0.5.1 - DTO validation/transformation
- `joi` 18.0.2 - Schema validation
- `ws` 8.19.0 - WebSocket support
- `@grpc/grpc-js` 1.14.3 - gRPC server/client
- `rxjs` 7.8.2 - Observable support for gRPC streaming

**Infrastructure:**
- `graphql-yoga` 5.18.1 + `type-graphql` 2.0.0-rc.3 + `graphql-ws` 6.0.7 - GraphQL support
- `parse-multipart-data` 1.5.0 - Multipart form parsing
- `aws-lambda` 1.0.7 + `@types/aws-lambda` 8.10.161 - AWS Lambda adapter

## Configuration

**Environment:**
- `.env` file with `NPM_TOKEN` and `LOG_ERRORS`
- No runtime env validation detected

**Build:**
- `tsconfig.json` - Root TypeScript config (ES2022, nodenext, strict, decorators enabled)
- `tsconfig.build.json` - Per-package build configs
- `eslint.config.js` - Flat ESLint config
- `.prettierrc` - Prettier config (singleQuote, trailingComma es5, 100 width)

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- Yarn 1.x

**Production:**
- Published to npm as `@heliosjs/*` scoped packages
- ESM-first (`"type": "module"`)

---

*Stack analysis: 2026-09-03*
