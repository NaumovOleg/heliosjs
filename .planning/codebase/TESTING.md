# Testing Patterns

**Analysis Date:** 2026-09-03

## Test Framework

**Runner:**
- Vitest ^4.1.9
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`)

**Run Commands:**
```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:coverage     # Coverage with V8
```

## Test File Organization

**Location:**
- Separate from source: `__tests__/` at package root

**Naming:**
- `<feature>.test.ts` (kebab-case)
- Mirrors `src/` structure: `__tests__/core/`, `__tests__/middlewares/`, `__tests__/http/`

**Structure:**
```
__tests__/
├── core/
│   ├── match.test.ts
│   ├── fingerprint.test.ts
│   ├── parsers.test.ts
│   ├── ratelimit-*.test.ts (7 files)
│   ├── pipeline-*.test.ts
│   └── ...
├── middlewares/
│   ├── smoke.test.ts
│   ├── roles.test.ts
│   └── ...
└── http/
    └── body-limit.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';
import { someFunction } from '@heliosjs/core/utils';

describe('featureName', () => {
  it('does something specific', () => {
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- One `describe` block per function/feature
- One `it` per behavior/scenario
- Descriptive test names explaining the behavior
- Helper factories in `__tests__/helpers/` (e.g., `makeRoute`, `makeControllerMeta`)

## Mocking

**Framework:** None detected (tests use real implementations)

**Patterns:**
- Direct function imports and invocation
- Factory functions for test data (`makeRoute`, `makeControllerMeta`)
- No `vi.fn()` or `vi.mock()` usage detected

**What to Mock:**
- External services (AWS, databases) when testing adapters
- Network calls if added in future

**What NOT to Mock:**
- Core utility functions (tested directly)
- Decorator metadata (tested via real decorators)

## Fixtures and Factories

**Test Data:**
```typescript
// From __tests__/helpers/http.ts
makeRoute({ route: '/users', method: 'GET' })
makeControllerMeta({ routes: [...] })
```

**Location:**
- `__tests__/helpers/` directory

## Coverage

**Requirements:**
- Lines: 65%
- Functions: 75%
- Statements: 65%
- Branches: 65%

**Coverage Scope:**
- Only specific files covered (not all source):
  - `src/core/src/utils/core/match.ts`
  - `src/core/src/utils/shared/parsers.ts`
  - `src/core/src/utils/core/controller.ts`

**View Coverage:**
```bash
yarn test:coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Direct invocation with assertions
- Examples: `match.test.ts`, `parsers.test.ts`, `fingerprint.test.ts`

**Integration Tests:**
- Scope: Controller compilation, middleware pipeline
- Approach: Real decorator usage with metadata verification
- Examples: `pipeline-execute.test.ts`, `ratelimit-integration.test.ts`

**E2E Tests:**
- Framework: None detected
- No HTTP server lifecycle tests found

## Common Patterns

**Async Testing:**
```typescript
it('handles async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it('throws on invalid input', () => {
  expect(() => invalidCall()).toThrow(TypeError);
});
```

**Setup:**
```typescript
// vitest.setup.ts
import 'reflect-metadata';
```
- Reflect metadata imported globally for decorator support

## Test Coverage Gaps

**Untested:**
- HTTP server lifecycle (`Helios.listen`, `Helios.close`)
- Lambda adapter (`src/aws/`)
- gRPC server/client (`src/grpc/`)
- WebSocket handling
- SSE handling
- GraphQL integration

**Priority:**
- Lambda adapter: High (production deployment path)
- HTTP lifecycle: Medium (core functionality)
- gRPC: Medium (newer package)

---

*Testing analysis: 2026-09-03*
