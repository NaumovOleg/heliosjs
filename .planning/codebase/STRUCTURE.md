# Codebase Structure

**Analysis Date:** 2026-09-03

## Directory Layout

```
packages/
├── src/
│   ├── core/              # Core framework: decorators, types, utilities
│   │   ├── src/
│   │   │   ├── Controller.ts        # @Controller decorator
│   │   │   ├── Endpoint.ts          # Endpoint abstraction
│   │   │   ├── decorators.ts        # @Body, @Params, @RateLimit, etc.
│   │   │   ├── constants.ts         # Metadata keys
│   │   │   ├── descriptors/         # Property descriptors
│   │   │   ├── types/               # Type definitions
│   │   │   └── utils/               # Utilities (core, socket, sse, shared)
│   │   └── package.json
│   ├── http/              # HTTP server runtime
│   │   ├── src/
│   │   │   ├── Helios.ts            # Main HTTP server class
│   │   │   ├── decorators.ts        # @Server, @Port, @Host
│   │   │   ├── types/               # HTTP types
│   │   │   └── utils/               # Request/response factories
│   │   └── package.json
│   ├── aws/               # AWS Lambda adapter
│   │   ├── src/
│   │   │   ├── lambda.ts            # Lambda Helios class
│   │   │   ├── types/               # Lambda types
│   │   │   └── utils/               # Event normalizers, factories
│   │   └── package.json
│   ├── grpc/              # gRPC server/client
│   │   ├── src/
│   │   │   ├── server.ts            # GrpcServer class
│   │   │   ├── client.ts            # GrpcClient class
│   │   │   ├── decorators.ts        # @GrpcService, @GrpcMethod
│   │   │   ├── types/               # gRPC types
│   │   │   └── utils/               # Helpers, error normalization
│   │   └── package.json
│   └── middlewares/       # Reusable middleware
│       ├── src/
│       │   ├── cors.ts, guard.ts, pipe.ts, roles.ts, etc.
│       │   └── index.ts
│       └── package.json
├── __tests__/             # Test files
│   ├── core/              # Core tests (23 files)
│   ├── middlewares/       # Middleware tests (6 files)
│   └── http/              # HTTP tests (1 file)
├── package.json           # Root workspace config
├── tsconfig.json          # Root TypeScript config
├── vitest.config.ts       # Test config
├── eslint.config.js       # Linting config
└── .prettierrc            # Formatting config
```

## Directory Purposes

**`src/core/src/`:**
- Purpose: Framework core - decorators, metadata, types, utilities
- Contains: TypeScript source files
- Key files: `Controller.ts`, `decorators.ts`, `constants.ts`

**`src/core/src/utils/core/`:**
- Purpose: Core utility functions
- Contains: Route matching, CORS, RBAC, fingerprinting, rate limiting, error handling
- Key files: `match.ts`, `controller.ts`, `response.ts`, `request.ts`

**`src/core/src/types/core/`:**
- Purpose: Core type definitions
- Contains: Interfaces for Request, Response, Controller, Middleware, etc.
- Key files: `controller.ts`, `request.ts`, `response.ts`

**`__tests__/`:**
- Purpose: Unit and integration tests
- Contains: Vitest test files mirroring `src/` structure
- Key files: `core/match.test.ts`, `core/ratelimit-*.test.ts`

## Key File Locations

**Entry Points:**
- `src/http/src/Helios.ts`: HTTP server entry
- `src/aws/src/lambda.ts`: Lambda handler entry
- `src/grpc/src/server.ts`: gRPC server entry

**Configuration:**
- `package.json`: Workspace and dependency config
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.ts`: Test runner config
- `eslint.config.js`: Linting rules

**Core Logic:**
- `src/core/src/Controller.ts`: Controller decorator implementation
- `src/core/src/decorators.ts`: Parameter/method decorators
- `src/core/src/utils/core/controller.ts`: Controller compilation
- `src/core/src/utils/core/match.ts`: Route matching

**Testing:**
- `__tests__/core/match.test.ts`: Route matching tests
- `__tests__/core/ratelimit-*.test.ts`: Rate limiting tests
- `vitest.setup.ts`: Test setup (imports `reflect-metadata`)

## Naming Conventions

**Files:**
- PascalCase for classes: `Controller.ts`, `Helios.ts`
- camelCase for utilities: `match.ts`, `controller.ts`
- kebab-case for test files: `ratelimit-decorator.test.ts`
- `index.ts` for barrel exports

**Directories:**
- lowercase, singular: `core/`, `http/`, `aws/`, `grpc/`
- Types in `types/` subdirectories
- Utils in `utils/` subdirectories

## Where to Add New Code

**New Decorator:**
- Parameter decorator: `src/core/src/decorators.ts`
- Class decorator: `src/core/src/Controller.ts` or new file in `src/core/src/`

**New Middleware:**
- Implementation: `src/middlewares/src/`
- Export from: `src/middlewares/src/index.ts`

**New Adapter (e.g., Fastify):**
- New package: `src/<adapter>/`
- Follow pattern of `src/http/` or `src/aws/`

**New Utility:**
- Core utility: `src/core/src/utils/core/`
- Shared utility: `src/core/src/utils/shared/`

**New Type:**
- Core types: `src/core/src/types/core/`
- Package-specific: `src/<package>/src/types/`

**New Test:**
- Location: `__tests__/<package>/`
- Naming: `<feature>.test.ts`

## Special Directories

**`dist/`:**
- Purpose: Compiled JavaScript output
- Generated: Yes (via `tsc`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via `yarn`)
- Committed: No

**`.changeset/`:**
- Purpose: Changeset files for versioning
- Generated: Yes (via `changeset`)
- Committed: Yes

---

*Structure analysis: 2026-09-03*
