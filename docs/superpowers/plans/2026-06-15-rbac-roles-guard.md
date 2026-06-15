# RBAC `@Roles` Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `@Roles(...)` decorator that restricts controllers/routes by role, built on the existing guard pipeline, with a configurable global role extractor.

**Architecture:** `@Roles` is a guard factory: it closes over the required roles and reads a globally-registered extractor (`getRoles(req)`) configured via `@Server({ rbac })`. The extractor is held in a module-level singleton in `core` (shared dep), set at Helios bootstrap, and read by the guard closure in `middlewares`. A pre-existing bug in `runGuard` (function guards returning `true` are wrongly rejected) is fixed as part of this work.

**Tech Stack:** TypeScript (nodenext, ES2022), reflect-metadata, Vitest (new — added to `middlewares`), yarn workspaces.

---

## Spec

See `docs/superpowers/specs/2026-06-15-rbac-roles-guard-design.md`.

## File Structure

| Package     | File                                      | Responsibility                                  |
| ----------- | ----------------------------------------- | ----------------------------------------------- |
| core        | `src/utils/core/controller.ts` (modify)   | Fix + export `runGuard` (function-guard allow)  |
| core        | `src/utils/core/rbac.ts` (new)            | Extractor holder `set/getRolesExtractor`        |
| core        | `src/types/core/rbac.ts` (new)            | `RolesExtractor` type                           |
| core        | `src/types/core/index.ts` (modify)        | Re-export rbac type                             |
| core        | `src/utils/core/index.ts` (modify)        | Re-export rbac holder                           |
| core        | `src/index.ts` (modify)                    | Public export of type + holder                  |
| middlewares | `vitest.config.ts` (new)                  | Vitest config + alias core→source               |
| middlewares | `vitest.setup.ts` (new)                   | `import 'reflect-metadata'`                      |
| middlewares | `src/roles.ts` (new)                       | `matchRoles`, `normalizeArgs`, `createRolesGuard`, `Roles` |
| middlewares | `src/index.ts` (modify)                    | Export `roles`                                  |
| middlewares | `src/runGuard.test.ts` (new)              | Regression test for the runGuard fix            |
| middlewares | `src/rbac-holder.test.ts` (new)           | Holder set/get test                             |
| middlewares | `src/roles.test.ts` (new)                 | Roles logic + decorator tests                   |
| http        | `src/types/http/http.ts` (modify)          | `RBACConfig` + `ServerConfig.rbac`              |
| http        | `src/Helios.ts` (modify)                    | `setRolesExtractor(config.rbac?.getRoles)`     |

**Test commands** (single runner in middlewares; core source is aliased):
- All: `yarn workspace @heliosjs/middlewares test`
- One file: `yarn workspace @heliosjs/middlewares test <name>`

---

### Task 1: Vitest setup in `middlewares`

**Files:**
- Create: `src/middlewares/vitest.config.ts`
- Create: `src/middlewares/vitest.setup.ts`
- Create: `src/middlewares/src/smoke.test.ts`
- Modify: `src/middlewares/package.json` (scripts + devDependency)

- [ ] **Step 1: Add Vitest devDependency**

Run: `yarn workspace @heliosjs/middlewares add -D vitest`
Expected: `vitest` added under `devDependencies` in `src/middlewares/package.json`.

- [ ] **Step 2: Add test scripts to `src/middlewares/package.json`**

In the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `src/middlewares/vitest.setup.ts`**

```ts
import 'reflect-metadata';
```

- [ ] **Step 4: Create `src/middlewares/vitest.config.ts`**

Aliases map `@heliosjs/core` subpaths to core **source** so core changes are testable from this single runner without rebuilding. Longer prefixes are listed first so they match before the bare package name.

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@heliosjs/core/utils',
        replacement: resolve(__dirname, '../core/src/utils/index.ts'),
      },
      {
        find: '@heliosjs/core/types',
        replacement: resolve(__dirname, '../core/src/types/index.ts'),
      },
      {
        find: '@heliosjs/core',
        replacement: resolve(__dirname, '../core/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 5: Write a smoke test `src/middlewares/src/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@heliosjs/core/utils';

describe('vitest + core alias', () => {
  it('resolves core source through alias', () => {
    expect(typeof ForbiddenError).toBe('function');
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `yarn workspace @heliosjs/middlewares test smoke`
Expected: PASS (1 test). Confirms vitest runs and the core-source alias resolves.

- [ ] **Step 7: Commit**

```bash
git add src/middlewares/package.json src/middlewares/vitest.config.ts src/middlewares/vitest.setup.ts src/middlewares/src/smoke.test.ts
git commit -m "test(middlewares): add vitest with core-source alias"
```

---

### Task 2: Fix and export `runGuard` (function-guard allow)

**Problem:** In `src/core/src/utils/core/controller.ts`, `runGuard` declares `let canActivate;` and, for a `GuardFunction`, only assigns it when the result is `false` or a string. A function guard returning `true` leaves `canActivate` undefined, so `if (!canActivate) throw new ForbiddenError(message)` rejects valid requests. Approach 1 returns `true` on success, so this must be fixed.

**Files:**
- Modify: `src/core/src/utils/core/controller.ts:199-226`
- Test: `src/middlewares/src/runGuard.test.ts`

- [ ] **Step 1: Write the failing test `src/middlewares/src/runGuard.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ForbiddenError, runGuard } from '@heliosjs/core/utils';
import type { Request, Response } from '@heliosjs/core/types';

const req = {} as Request;
const res = {} as Response;

describe('runGuard (function guard)', () => {
  it('allows when the guard returns true', async () => {
    await expect(runGuard(() => true, req, res)).resolves.toBeUndefined();
  });

  it('rejects with ForbiddenError when the guard returns false', async () => {
    await expect(runGuard(() => false, req, res)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects with the returned string as message', async () => {
    await expect(runGuard(() => 'nope', req, res)).rejects.toThrow('nope');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace @heliosjs/middlewares test runGuard`
Expected: FAIL — first test errors because `runGuard` is not exported (and the true-case rejects).

- [ ] **Step 3: Fix and export `runGuard`**

In `src/core/src/utils/core/controller.ts`, change the signature `async function runGuard(` to `export async function runGuard(`. Then replace the `else` (function-guard) branch body so the boolean result is assigned:

Current:
```ts
  } else {
    const result = await guard(request, response);
    if (result === false) {
      canActivate = false;
    }
    if (typeof result === 'string') {
      canActivate = false;
      message = result;
    }
  }
```

New:
```ts
  } else {
    const result = await guard(request, response);
    if (typeof result === 'string') {
      canActivate = false;
      message = result;
    } else {
      canActivate = result;
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace @heliosjs/middlewares test runGuard`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/utils/core/controller.ts src/middlewares/src/runGuard.test.ts
git commit -m "fix(core): allow function guards that return true"
```

---

### Task 3: Extractor type + holder in `core`

**Files:**
- Create: `src/core/src/types/core/rbac.ts`
- Create: `src/core/src/utils/core/rbac.ts`
- Modify: `src/core/src/types/core/index.ts`
- Modify: `src/core/src/utils/core/index.ts`
- Modify: `src/core/src/index.ts`
- Test: `src/middlewares/src/rbac-holder.test.ts`

- [ ] **Step 1: Write the failing test `src/middlewares/src/rbac-holder.test.ts`**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { getRolesExtractor, setRolesExtractor } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

afterEach(() => setRolesExtractor(undefined));

describe('roles extractor holder', () => {
  it('is undefined before being set', () => {
    expect(getRolesExtractor()).toBeUndefined();
  });

  it('returns the extractor after set', () => {
    const fn = (_req: Request) => ['admin'];
    setRolesExtractor(fn);
    expect(getRolesExtractor()).toBe(fn);
  });

  it('clears when set to undefined', () => {
    setRolesExtractor((_req: Request) => 'admin');
    setRolesExtractor(undefined);
    expect(getRolesExtractor()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace @heliosjs/middlewares test rbac-holder`
Expected: FAIL — `getRolesExtractor`/`setRolesExtractor` not exported.

- [ ] **Step 3: Create the type `src/core/src/types/core/rbac.ts`**

```ts
import type { Request } from './request';

export type RolesExtractor = (
  req: Request,
) => string | string[] | undefined | Promise<string | string[] | undefined>;
```

- [ ] **Step 4: Create the holder `src/core/src/utils/core/rbac.ts`**

```ts
import type { RolesExtractor } from '../../types/core/rbac';

let extractor: RolesExtractor | undefined;

export function setRolesExtractor(fn: RolesExtractor | undefined): void {
  extractor = fn;
}

export function getRolesExtractor(): RolesExtractor | undefined {
  return extractor;
}
```

- [ ] **Step 5: Re-export from barrels**

In `src/core/src/types/core/index.ts`, add:
```ts
export * from './rbac';
```

In `src/core/src/utils/core/index.ts`, add:
```ts
export * from './rbac';
```

- [ ] **Step 6: Add public exports in `src/core/src/index.ts`**

Add `RolesExtractor` to the type re-export block (the one that lists `Request`, `Response`, etc.):
```ts
  RolesExtractor,
```

Add the holder to the utils re-export block (the one that lists `ForbiddenError`, `InvalidStateError`, etc.):
```ts
  getRolesExtractor,
  setRolesExtractor,
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `yarn workspace @heliosjs/middlewares test rbac-holder`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/core/src/types/core/rbac.ts src/core/src/utils/core/rbac.ts src/core/src/types/core/index.ts src/core/src/utils/core/index.ts src/core/src/index.ts src/middlewares/src/rbac-holder.test.ts
git commit -m "feat(core): add roles extractor type and holder"
```

---

### Task 4: `matchRoles` and `normalizeArgs` (pure logic)

**Files:**
- Create: `src/middlewares/src/roles.ts`
- Test: `src/middlewares/src/roles.test.ts`

- [ ] **Step 1: Write the failing test `src/middlewares/src/roles.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { matchRoles, normalizeArgs } from './roles';

describe('matchRoles', () => {
  it('ANY passes when one required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['editor'], 'any')).toBe(true);
  });
  it('ANY fails when no required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['viewer'], 'any')).toBe(false);
  });
  it('ALL passes when every required role is present', () => {
    expect(matchRoles(['admin', 'editor'], ['editor', 'admin'], 'all')).toBe(true);
  });
  it('ALL fails when one required role is missing', () => {
    expect(matchRoles(['admin', 'editor'], ['admin'], 'all')).toBe(false);
  });
});

describe('normalizeArgs', () => {
  it('flattens varargs strings, defaults to ANY', () => {
    expect(normalizeArgs(['admin', 'editor'])).toEqual({
      roles: ['admin', 'editor'],
      options: {},
    });
  });
  it('flattens a single array arg', () => {
    expect(normalizeArgs([['admin', 'editor']])).toEqual({
      roles: ['admin', 'editor'],
      options: {},
    });
  });
  it('extracts a trailing options object', () => {
    expect(normalizeArgs([['admin', 'editor'], { mode: 'all' }])).toEqual({
      roles: ['admin', 'editor'],
      options: { mode: 'all' },
    });
  });
  it('extracts options after varargs', () => {
    expect(normalizeArgs(['admin', { message: 'no' }])).toEqual({
      roles: ['admin'],
      options: { message: 'no' },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: FAIL — `./roles` module / exports do not exist.

- [ ] **Step 3: Create `src/middlewares/src/roles.ts` with the pure helpers**

```ts
export type RoleMode = 'any' | 'all';

export interface RolesOptions {
  mode?: RoleMode;
  message?: string;
}

type RolesArg = string | string[];

export function matchRoles(
  required: string[],
  userRoles: string[],
  mode: RoleMode,
): boolean {
  return mode === 'all'
    ? required.every((role) => userRoles.includes(role))
    : required.some((role) => userRoles.includes(role));
}

export function normalizeArgs(
  args: (RolesArg | RolesOptions)[],
): { roles: string[]; options: RolesOptions } {
  let options: RolesOptions = {};
  let roleArgs = args;

  const last = args[args.length - 1];
  const isOptions =
    typeof last === 'object' && last !== null && !Array.isArray(last);

  if (isOptions) {
    options = last as RolesOptions;
    roleArgs = args.slice(0, -1);
  }

  const roles = (roleArgs as RolesArg[]).flatMap((arg) =>
    Array.isArray(arg) ? arg : [arg],
  );

  return { roles, options };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: PASS (matchRoles + normalizeArgs suites).

- [ ] **Step 5: Commit**

```bash
git add src/middlewares/src/roles.ts src/middlewares/src/roles.test.ts
git commit -m "feat(middlewares): add matchRoles and normalizeArgs"
```

---

### Task 5: `createRolesGuard` (guard closure)

**Files:**
- Modify: `src/middlewares/src/roles.ts`
- Test: `src/middlewares/src/roles.test.ts`

- [ ] **Step 1: Add failing tests to `src/middlewares/src/roles.test.ts`**

Add these imports at the top of the file:
```ts
import { afterEach } from 'vitest';
import { setRolesExtractor } from '@heliosjs/core/utils';
import { InvalidStateError } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';
import { createRolesGuard } from './roles';
```

Append this suite:
```ts
const req = {} as Request;

describe('createRolesGuard', () => {
  afterEach(() => setRolesExtractor(undefined));

  it('returns true when extractor roles satisfy ANY', async () => {
    setRolesExtractor(() => ['editor']);
    const guard = createRolesGuard(['admin', 'editor'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('returns the message string when roles do not satisfy', async () => {
    setRolesExtractor(() => ['viewer']);
    const guard = createRolesGuard(['admin'], { message: 'Admins only' });
    await expect(guard(req, {} as never)).resolves.toBe('Admins only');
  });

  it('uses the default message when none provided', async () => {
    setRolesExtractor(() => []);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('normalizes a single string from the extractor', async () => {
    setRolesExtractor(() => 'admin');
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('treats undefined extractor result as no roles', async () => {
    setRolesExtractor(() => undefined);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('awaits an async extractor', async () => {
    setRolesExtractor(async () => ['admin']);
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).resolves.toBe(true);
  });

  it('enforces ALL mode', async () => {
    setRolesExtractor(() => ['admin']);
    const guard = createRolesGuard(['admin', 'editor'], { mode: 'all' });
    await expect(guard(req, {} as never)).resolves.toBe('Insufficient role');
  });

  it('throws InvalidStateError when no extractor is configured', async () => {
    const guard = createRolesGuard(['admin'], {});
    await expect(guard(req, {} as never)).rejects.toBeInstanceOf(InvalidStateError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: FAIL — `createRolesGuard` is not exported.

- [ ] **Step 3: Add `createRolesGuard` to `src/middlewares/src/roles.ts`**

Add imports at the top:
```ts
import type { GuardFunction } from '@heliosjs/core/types';
import { getRolesExtractor, InvalidStateError } from '@heliosjs/core/utils';
```

Add the factory (after `normalizeArgs`):
```ts
export function createRolesGuard(
  required: string[],
  options: RolesOptions,
): GuardFunction {
  const mode = options.mode ?? 'any';
  const message = options.message ?? 'Insufficient role';

  return async (req) => {
    const extractor = getRolesExtractor();
    if (!extractor) {
      throw new InvalidStateError(
        'RBAC extractor not set; configure rbac.getRoles in @Server',
      );
    }

    const raw = await extractor(req);
    const userRoles = raw == null ? [] : Array.isArray(raw) ? raw : [raw];

    return matchRoles(required, userRoles, mode) ? true : message;
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: PASS (matchRoles + normalizeArgs + createRolesGuard).

- [ ] **Step 5: Commit**

```bash
git add src/middlewares/src/roles.ts src/middlewares/src/roles.test.ts
git commit -m "feat(middlewares): add createRolesGuard closure"
```

---

### Task 6: `Roles` decorator + barrel export

**Files:**
- Modify: `src/middlewares/src/roles.ts`
- Modify: `src/middlewares/src/index.ts`
- Test: `src/middlewares/src/roles.test.ts`

- [ ] **Step 1: Add failing decorator tests to `src/middlewares/src/roles.test.ts`**

Add this import:
```ts
import { reflectMiddlewaresMetadata } from '@heliosjs/core/utils';
import { Roles } from './roles';
```

Append:
```ts
describe('Roles decorator', () => {
  it('registers a guard on a controller class', () => {
    class Ctrl {}
    Roles('admin')(Ctrl);

    const meta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].guard).toBe('function');
  });

  it('registers a guard on a method', () => {
    class Ctrl {
      handler() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(Ctrl.prototype, 'handler')!;
    Roles('admin')(Ctrl.prototype, 'handler', descriptor);

    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler') ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].guard).toBe('function');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: FAIL — `Roles` is not exported.

- [ ] **Step 3: Add the `Roles` decorator to `src/middlewares/src/roles.ts`**

Add the import:
```ts
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
```

Add at the end of the file (follows the same registration pattern as `guard.ts`):
```ts
/**
 * Restrict a controller or route to users holding the required role(s).
 *
 * Roles are read through the extractor configured via `@Server({ rbac })`.
 * Default match mode is ANY (the user needs at least one listed role); pass
 * `{ mode: 'all' }` to require every role. A failing check throws
 * `ForbiddenError` with `options.message` (default `"Insufficient role"`).
 *
 * @example
 * @Roles('admin')
 * @example
 * @Roles('admin', 'editor')                     // ANY
 * @example
 * @Roles(['admin', 'editor'], { mode: 'all' })  // ALL
 */
export function Roles(...args: (RolesArg | RolesOptions)[]) {
  const { roles, options } = normalizeArgs(args);
  const guard = createRolesGuard(roles, options);

  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const data = [{ guard }];

    if (descriptor) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
```

- [ ] **Step 4: Export from `src/middlewares/src/index.ts`**

Add (keep the list alphabetical with the existing entries):
```ts
export * from './roles';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn workspace @heliosjs/middlewares test roles`
Expected: PASS (all roles suites).

- [ ] **Step 6: Run the full middlewares suite**

Run: `yarn workspace @heliosjs/middlewares test`
Expected: PASS — smoke, runGuard, rbac-holder, roles.

- [ ] **Step 7: Commit**

```bash
git add src/middlewares/src/roles.ts src/middlewares/src/index.ts src/middlewares/src/roles.test.ts
git commit -m "feat(middlewares): add Roles decorator"
```

---

### Task 7: Wire RBAC config into `http`

**Files:**
- Modify: `src/http/src/types/http/http.ts`
- Modify: `src/http/src/Helios.ts`

- [ ] **Step 1: Add `RBACConfig` type and `ServerConfig.rbac` in `src/http/src/types/http/http.ts`**

Add the import (with the other `@heliosjs/core` type imports near the top of the file):
```ts
import type { RolesExtractor } from '@heliosjs/core/types';
```

Add above `export interface ServerConfig {`:
```ts
export interface RBACConfig {
  /** Returns the role(s) for the current request. */
  getRoles: RolesExtractor;
}
```

Add this field inside `ServerConfig` (after `errorHandler`):
```ts
  /**
   * Role-based access control configuration consumed by the `@Roles` guard.
   */
  rbac?: RBACConfig;
```

- [ ] **Step 2: Register the extractor at bootstrap in `src/http/src/Helios.ts`**

Add to the imports from `@heliosjs/core/utils` (or add a new import line if none exists):
```ts
import { setRolesExtractor } from '@heliosjs/core/utils';
```

In the `Helios` constructor, immediately after `this.config = resolveConfig(configOrClass);`, add:
```ts
    setRolesExtractor(this.config.rbac?.getRoles);
```

- [ ] **Step 3: Verify the whole monorepo builds (type-checks across packages)**

Run: `yarn build:core && yarn build:middlewares && yarn build:http`
Expected: all three compile with no TypeScript errors. (`build:core` must run first because `http`/`middlewares` consume core's `dist` types.)

- [ ] **Step 4: Re-run the middlewares test suite against built core**

Run: `yarn workspace @heliosjs/middlewares test`
Expected: PASS — confirms nothing regressed after the build.

- [ ] **Step 5: Commit**

```bash
git add src/http/src/types/http/http.ts src/http/src/Helios.ts
git commit -m "feat(http): wire rbac extractor into Server config"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `yarn workspace @heliosjs/middlewares test`
Expected: PASS — all suites (smoke, runGuard, rbac-holder, roles).

- [ ] **Build all packages**

Run: `yarn build`
Expected: full monorepo build succeeds.

- [ ] **Lint**

Run: `yarn lint`
Expected: no errors.

- [ ] **Manual end-to-end sanity (optional)**

In a scratch app:
```ts
@Server({ rbac: { getRoles: (req) => req.getState('user')?.roles ?? [] } })
class App { /* controllers */ }

@Roles('admin')
class AdminController {}
```
Request without `admin` role → 403 `Insufficient role`. Request with it → handler runs.

## Acceptance Criteria

- `@Roles('admin')` and `@Roles('admin','editor')` work at controller and method level (ANY).
- `@Roles([...], { mode: 'all' })` enforces ALL.
- Extractor configured via `@Server({ rbac: { getRoles } })`; accepts `string | string[] | undefined`, sync or async.
- Insufficient roles → `ForbiddenError` (403) with default or custom message.
- No extractor configured → `InvalidStateError`.
- Function guards returning `true` are allowed (runGuard fix), with regression test.
- All tests pass; monorepo builds; lint clean.
