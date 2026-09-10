# Testing Patterns

**Analysis Date:** 2026-09-10

## Test Framework

**Runner:**
- Vitest `^4.1.9`
- Config: `vitest.config.ts` (single root config for the whole workspace)
- `oxc.decoratorLegacy: true` so `experimentalDecorators` behavior works under vitest
- Setup: `vitest.setup.ts` → `import 'reflect-metadata'` (also imported explicitly at the top of most test files)
- Environment: `node`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`) plus `vi` for mocks/timers

**Run Commands:**
```bash
yarn test                 # vitest run — whole suite (~3s), the primary gate
yarn vitest run __tests__/core/match.test.ts        # single file
yarn vitest run -t "matches wildcard route"          # single test by name
yarn test:watch           # vitest (watch)
yarn test:coverage        # vitest run --coverage (v8) — see note below
```

## Test File Organization

**Location:**
- All tests under `__tests__/<pkg>/`, never inside `src/`
- Tests import implementation from **source** via `@heliosjs/*` aliases (`resolve.alias` in `vitest.config.ts`); no build needed first
- A minority import relatively (`../../../src/aws/src/lambda`) — both resolve; alias form preferred

**Naming:** `<feature>.test.ts`, kebab-case

**Structure:** ~98 test files. Layout is inconsistent by design — some suites sit flat in `__tests__/<pkg>/`, others under `unit/` or `e2e/`:
```
__tests__/
├── helpers/http.ts                      # shared factories (see below)
├── core/            ~18 flat + unit/{decorators,descriptors,error,
│                     multipart,parsers,ratelimit,sanitize,socket,sse,
│                     utils,ws,helpers}/
├── http/            body-limit.test.ts + unit/ (13) + e2e/ (4)
├── aws/             unit/ (7)
├── grpc/            unit/ (6)
└── middlewares/     ~5 flat + unit/ + e2e/ (1)
```
Several file names signal coverage-chasing rather than a feature: `final-coverage-push.test.ts`, `gaps-coverage.test.ts`, `remaining-gaps.test.ts`, `small-gaps.test.ts`, `helios-full-coverage.test.ts`.

**Excluded from the run** (`test.exclude` in `vitest.config.ts`) — only three files:
- `**/grpc/unit/server-extended.test.ts`
- `**/http/unit/factories.test.ts`
- `**/core/unit/socket/server.test.ts`

Note: `CLAUDE.md` also lists `middlewares/e2e/**` as excluded, but the current `vitest.config.ts` does **not** exclude it — `__tests__/middlewares/e2e/middleware-pipeline.test.ts` runs. Trust `vitest.config.ts`.

## Test Structure

**Suite Organization:**
```typescript
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { matchRoutes } from '@heliosjs/core/utils';
import { makeControllerMeta, makeRoute } from '../helpers/http';

const meta = (routes: any[]) => makeControllerMeta({ routes });

describe('matchRoutes', () => {
  it('matches a static route by path and method', () => {
    const r = makeRoute({ route: '/users', method: 'GET' });
    expect(matchRoutes(meta([r]), '/users', 'GET')).toBe(r);
  });
});
```

**Patterns:**
- One top-level `describe` per unit under test; nested `describe` for sub-behaviors (some files nest heavily — `api-workflow.test.ts` has 17 `describe` blocks, `request.test.ts` 16)
- One `it` per behavior, sentence-style names
- `beforeEach` / `afterEach` used where state must reset (77 hook call-sites); `afterEach` in E2E always closes the server
- Assertions skew concrete: `.toBe` (dominant), `.toEqual`, `.toBeDefined`, `.toThrow`, `.toContain`, `.toHaveBeenCalledWith`, `.toBeInstanceOf`
- No snapshot tests, no `it.each` / `describe.each`

## Mocking

**Framework:** Vitest `vi` — used in ~34 files (the 2026-09-03 doc claiming "none" is stale)

**Patterns:**
```typescript
// inline fake collaborator
this[CONTROLLER_REQUEST] = vi.fn(async (_req, res) => { res.data = { message: 'ok' }; return res; });

// stubbed WS server
const mockWss = { sendToClient: vi.fn().mockReturnValue(true), broadcast: vi.fn() };

// module mock — only 3 active files (grpc/unit/client, http/unit/helios-full-coverage) + 1 excluded
vi.mock(...)

// deterministic time for rate-limit windows
vi.useFakeTimers()   // ratelimit-{enforce,token-bucket,store,fixed-window,sliding-window}.test.ts
```

**What to Mock:**
- Transport internals when unit-testing an adapter (mock `CONTROLLER_REQUEST` controller, fake Lambda event/context — `__tests__/aws/unit/lambda-adapter.test.ts`)
- WebSocket/SSE server internals (`ws` / socket servers)
- Wall-clock time for rate-limit strategies (`vi.useFakeTimers`)
- `process.env` via `vi.stubEnv` where behavior branches on `NODE_ENV`

**What NOT to Mock:**
- Core utilities and decorator metadata — exercised through the real `Reflect` metadata + real `@Controller` compilation
- The HTTP pipeline in E2E tests — a real `node:http` server is started

## Fixtures and Factories

**Location:** `__tests__/helpers/http.ts` (single shared helper module)

**Factories:**
```typescript
makeRequest(overrides)          // Request with Map-backed state, getHeader/getParam/getQuery/getClientIp
makeResponse()                  // FakeResponse: captures .errored, .headers, .data, .status
makeRoute(overrides)            // Route: { name, route, method, parameters, functions, fn, cors }
makeControllerMeta(overrides)   // ControllerMeta: { prefix, name, routes, children, functions, controllers }
```
- Heavy use of `as unknown as T` / `any` in factories and in E2E `buildApp` reaching into private fields (`(app as any).rootControllers = ...`)
- E2E files define their own local `buildApp` / `startApp` / `makePort` helpers (duplicated between `http/e2e` and `middlewares/e2e`), port counters start at 19000 / 20000 and increment

## Coverage

**Provider:** v8 (`@vitest/coverage-v8` `^4`)

**Thresholds** (`test.coverage.thresholds`): `lines: 96`, `functions: 96`, `statements: 95`, `branches: 88`

**Include:** all five packages — `src/{core,http,aws,middlewares,grpc}/src/**/*.ts`

**Exclude from coverage:** `**/*.test.ts`, `**/*.spec.ts`, `**/index.ts`, `**/types/**`, `**/socket/server.ts`, `**/socket/socket.ts`, `**/sse/server.ts`, `**/grpc/src/server.ts`, `**/grpc/src/client.ts`, `**/grpc/src/module.ts`, `**/grpc/src/utils/**`

Check **both** the `test.exclude` and `coverage.exclude` lists before concluding something is covered.

**Note:** `yarn test:coverage` currently **fails on a clean `master`** (thresholds not met). Use `yarn test` + `yarn build` as the working gates. See `.claude/.../memory/lint-and-coverage-broken-on-master.md`.

## Test Types

**Unit Tests:**
- Direct function invocation with factory-built inputs: `match.test.ts`, `parsers.test.ts`, `fingerprint.test.ts`, `run-guard.test.ts`, error class tests
- Decorator tests read back `Reflect` metadata after applying the real decorator (`core/unit/decorators/*`, `core/unit/descriptors/*`)

**Integration Tests:**
- Controller compilation + middleware pipeline through real decorators: `pipeline-execute.test.ts`, `pipeline-before-request.test.ts`, `ratelimit-integration.test.ts`, `ratelimit-controller-level.test.ts`
- Lambda adapter with normalized fake events: `aws/unit/lambda-*.test.ts`

**E2E Tests:**
- Real `node:http` server, real `fetch()`: `__tests__/http/e2e/http-{pipeline,deep-pipeline,full-pipeline,plugins-pipeline}.test.ts` and `__tests__/middlewares/e2e/middleware-pipeline.test.ts`
- Pattern: `@Server({ port })` class → `new Helios(App)` → inject controllers into private fields → `raw.listen(port, '127.0.0.1')` → assert on `fetch` response → `afterEach` `await app.close()`
- gRPC has server/client tests but no cross-process E2E; the heavy `grpc/unit/server-extended.test.ts` is excluded

## Common Patterns

**Async Testing:**
```typescript
it('handles GET to controller route', async () => {
  const res = await fetch(`${base}/users`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ users: ['alice', 'bob'] });
});
```

**Error Testing:**
```typescript
it('throws on invalid input', () => {
  expect(() => invalidCall()).toThrow(TypeError);
});
// or, for the pipeline: assert response.errored / response.status rather than a throw
```

**Fake timers (rate limiting):**
```typescript
vi.useFakeTimers();
// ... advance with vi.setSystemTime / vi.advanceTimersByTime, then assert window rollover
```

## Test Coverage Gaps / Caveats

- Socket, SSE, and most of gRPC are excluded from coverage — treat them as lightly tested regardless of the headline percentage
- Two `*coverage*` / `*gaps*` test files per area exist purely to hit lines; they are brittle to refactors and reach into privates
- Route-matching behavior is in flux: `__tests__/core/match.test.ts` (currently modified) asserts "prefers the more specific route over declaration order" and static-child-over-parent-param — this contradicts the older "no specificity ranking" description in `CLAUDE.md`. Trust the tests + `src/core/src/utils/core/match.ts`.
- E2E port allocation is a plain incrementing counter — parallel/repeated runs in the same process can collide

---

*Testing analysis: 2026-09-10*
