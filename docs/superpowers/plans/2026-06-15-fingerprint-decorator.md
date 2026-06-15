# Fingerprint Decorator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add request fingerprinting — a `@Fingerprint()` param injector and a `@UseFingerprint()` attach decorator — built on the existing param/middleware pipelines, with configurable composition and HMAC/SHA-256 hashing.

**Architecture:** A pure compute core in `core` (component extractors + `computeFingerprint` + a `getOrComputeFingerprint` state cache + a config singleton, mirroring the RBAC holder). `@Fingerprint()` is a param decorator that lazily computes/caches; `@UseFingerprint()` is a non-blocking `middleware` decorator that attaches the value to request state for downstream guards/interceptors. Config is wired through `@Server` (http) and `LambdaOptions` (aws).

**Tech Stack:** TypeScript (nodenext, ES2022), node:crypto, reflect-metadata, Vitest (root runner, `__tests__/`), yarn workspaces.

---

## Spec

See `docs/superpowers/specs/2026-06-15-fingerprint-decorator-design.md`.

## File Structure

| Package     | File                                      | Responsibility                                              |
| ----------- | ----------------------------------------- | ----------------------------------------------------------- |
| core        | `src/types/core/fingerprint.ts` (new)     | `FingerprintComponent`, `FingerprintConfig`                 |
| core        | `src/utils/core/fingerprint.ts` (new)     | extractors, holder, `computeFingerprint`, `getOrComputeFingerprint`, `DEFAULT_COMPONENTS` |
| core        | `src/types/core/common.ts` (modify)       | add `'fingerprint'` to `ParamDecoratorType`                 |
| core        | `src/decorators.ts` (modify)              | `Fingerprint` param decorator                               |
| core        | `src/utils/core/controller.ts` (modify)   | `'fingerprint'` case in arg resolver                        |
| core        | `src/types/core/index.ts`, `src/utils/core/index.ts`, `src/index.ts` (modify) | barrels + public exports |
| middlewares | `src/fingerprint.ts` (new)                | `UseFingerprint` decorator                                  |
| middlewares | `src/index.ts` (modify)                   | export `fingerprint`                                        |
| http        | `src/types/http/http.ts` (modify)         | `ServerConfig.fingerprint?`                                 |
| http        | `src/Helios.ts` (modify)                  | guarded `setFingerprintConfig`                              |
| aws         | `src/types/aws/lambda.ts` (modify)        | `LambdaOptions.fingerprint?`                                |
| aws         | `src/lambda.ts` (modify)                  | guarded `setFingerprintConfig`                              |
| __tests__   | `__tests__/core/fingerprint.test.ts` (new)| compute + holder + param-decorator metadata                 |
| __tests__   | `__tests__/middlewares/use-fingerprint.test.ts` (new) | attach decorator behavior                       |

**Test commands** (single root runner; core + middlewares source aliased):
- All: `yarn test`
- One file: `yarn test <name>`

---

### Task 1: Compute core (types + util + holder) in `core`

**Files:**
- Create: `src/core/src/types/core/fingerprint.ts`
- Create: `src/core/src/utils/core/fingerprint.ts`
- Modify: `src/core/src/types/core/index.ts`
- Modify: `src/core/src/utils/core/index.ts`
- Modify: `src/core/src/index.ts`
- Test: `__tests__/core/fingerprint.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/core/fingerprint.test.ts`**

```ts
import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  getFingerprintConfig,
  getOrComputeFingerprint,
  setFingerprintConfig,
} from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

function makeReq(
  opts: { ip?: string; userAgent?: string; headers?: Record<string, string | string[]> } = {},
): Request {
  const state = new Map<string, unknown>();
  const headers = opts.headers ?? {};
  return {
    userAgent: opts.userAgent ?? '',
    getClientIp: () => opts.ip ?? '',
    getHeader: (name: string) => headers[name.toLowerCase()],
    getState: <T>(key: string) => state.get(key) as T | undefined,
    setState: (key: string, value: unknown) => {
      state.set(key, value);
    },
  } as unknown as Request;
}

afterEach(() => setFingerprintConfig(undefined));

describe('computeFingerprint', () => {
  it('hashes default components (ip|userAgent|acceptLanguage) with sha256', () => {
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const expected = createHash('sha256').update('1.1.1.1|UA|en').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('is stable for identical requests and differs for different ones', () => {
    const a = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const b = makeReq({ ip: '2.2.2.2', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    expect(computeFingerprint(a)).toBe(computeFingerprint(makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } })));
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b));
  });

  it('honors a per-call component override', () => {
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    const expected = createHash('sha256').update('UA').digest('hex');
    expect(computeFingerprint(req, ['userAgent'])).toBe(expected);
  });

  it('honors global components config when no override', () => {
    setFingerprintConfig({ components: ['userAgent'] });
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    const expected = createHash('sha256').update('UA').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('uses HMAC-SHA-256 when a secret is configured', () => {
    setFingerprintConfig({ secret: 's3cr3t' });
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    const expected = createHmac('sha256', 's3cr3t').update('1.1.1.1|UA|en').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });

  it('uses a custom compute override verbatim', () => {
    setFingerprintConfig({ compute: () => 'CUSTOM' });
    expect(computeFingerprint(makeReq())).toBe('CUSTOM');
  });

  it('normalizes array headers and treats missing components as empty', () => {
    const req = makeReq({ ip: '1.1.1.1', headers: { 'accept-language': ['en', 'fr'] } });
    const expected = createHash('sha256').update('1.1.1.1||en,fr').digest('hex');
    expect(computeFingerprint(req)).toBe(expected);
  });
});

describe('getOrComputeFingerprint', () => {
  it('computes once and caches in request state', () => {
    let calls = 0;
    setFingerprintConfig({ compute: () => { calls++; return 'v'; } });
    const req = makeReq();
    expect(getOrComputeFingerprint(req)).toBe('v');
    expect(getOrComputeFingerprint(req)).toBe('v');
    expect(calls).toBe(1);
    expect(req.getState('fingerprint')).toBe('v');
  });
});

describe('fingerprint config holder', () => {
  it('is undefined before set, returns after set, clears on undefined', () => {
    expect(getFingerprintConfig()).toBeUndefined();
    const cfg = { secret: 's' };
    setFingerprintConfig(cfg);
    expect(getFingerprintConfig()).toBe(cfg);
    setFingerprintConfig(undefined);
    expect(getFingerprintConfig()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test fingerprint`
Expected: FAIL — `computeFingerprint` etc. not exported.

- [ ] **Step 3: Create the types `src/core/src/types/core/fingerprint.ts`**

```ts
import type { Request } from './request';

export type FingerprintComponent =
  | 'ip'
  | 'userAgent'
  | 'acceptLanguage'
  | 'acceptEncoding';

export interface FingerprintConfig {
  /** When set, components are HMAC-SHA-256'd with this secret; else plain SHA-256. */
  secret?: string;
  /** Component set to hash. Defaults to DEFAULT_COMPONENTS when omitted. */
  components?: FingerprintComponent[];
  /** Full override: compute the fingerprint string directly, bypassing components + hashing. */
  compute?: (req: Request) => string;
}
```

- [ ] **Step 4: Create the util `src/core/src/utils/core/fingerprint.ts`**

```ts
import { createHash, createHmac } from 'node:crypto';
import type { Request } from '../../types/core/request';
import type {
  FingerprintComponent,
  FingerprintConfig,
} from '../../types/core/fingerprint';

export const DEFAULT_COMPONENTS: FingerprintComponent[] = [
  'ip',
  'userAgent',
  'acceptLanguage',
];

const toStr = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v.join(',') : (v ?? '');

const COMPONENT_EXTRACTORS: Record<FingerprintComponent, (req: Request) => string> = {
  ip: (req) => req.getClientIp(),
  userAgent: (req) => req.userAgent ?? '',
  acceptLanguage: (req) => toStr(req.getHeader('accept-language')),
  acceptEncoding: (req) => toStr(req.getHeader('accept-encoding')),
};

let config: FingerprintConfig | undefined;

export function setFingerprintConfig(cfg: FingerprintConfig | undefined): void {
  config = cfg;
}

export function getFingerprintConfig(): FingerprintConfig | undefined {
  return config;
}

export function computeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const cfg = config ?? {};
  if (cfg.compute) return cfg.compute(req);

  const components = overrideComponents ?? cfg.components ?? DEFAULT_COMPONENTS;
  const raw = components.map((c) => COMPONENT_EXTRACTORS[c](req)).join('|');

  return cfg.secret
    ? createHmac('sha256', cfg.secret).update(raw).digest('hex')
    : createHash('sha256').update(raw).digest('hex');
}

export function getOrComputeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const existing = req.getState<string>('fingerprint');
  if (existing) return existing;
  const fp = computeFingerprint(req, overrideComponents);
  req.setState('fingerprint', fp);
  return fp;
}
```

- [ ] **Step 5: Re-export from barrels**

In `src/core/src/types/core/index.ts`, add (alphabetical position, near the other entries):
```ts
export * from './fingerprint';
```
In `src/core/src/utils/core/index.ts`, add:
```ts
export * from './fingerprint';
```

- [ ] **Step 6: Add public exports in `src/core/src/index.ts`**

Add to the named type re-export block (the one listing `Request`, `RolesExtractor`, etc.), keeping alphabetical order:
```ts
  FingerprintComponent,
  FingerprintConfig,
```
Add to the named utils re-export block (the one listing `ForbiddenError`, `getRolesExtractor`, etc.), keeping alphabetical order:
```ts
  computeFingerprint,
  DEFAULT_COMPONENTS,
  getFingerprintConfig,
  getOrComputeFingerprint,
  setFingerprintConfig,
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `yarn test fingerprint`
Expected: PASS (all `computeFingerprint`, `getOrComputeFingerprint`, holder suites).

- [ ] **Step 8: Commit**

```bash
git add src/core/src/types/core/fingerprint.ts src/core/src/utils/core/fingerprint.ts src/core/src/types/core/index.ts src/core/src/utils/core/index.ts src/core/src/index.ts __tests__/core/fingerprint.test.ts
git commit -m "feat(core): add fingerprint compute util and config holder"
```

---

### Task 2: `@Fingerprint()` param decorator + arg resolver wiring (`core`)

**Files:**
- Modify: `src/core/src/types/core/common.ts` (add `'fingerprint'` to `ParamDecoratorType`)
- Modify: `src/core/src/decorators.ts` (add `Fingerprint`)
- Modify: `src/core/src/utils/core/controller.ts` (arg resolver case)
- Test: `__tests__/core/fingerprint.test.ts` (append a param-decorator suite)

- [ ] **Step 1: Append the failing test to `__tests__/core/fingerprint.test.ts`**

Add these imports to the existing import block:
```ts
import { Fingerprint } from '@heliosjs/core';
import { reflectRouteMetadata } from '@heliosjs/core/utils';
```
Append:
```ts
describe('Fingerprint param decorator', () => {
  it('records a "fingerprint" param at the decorated index', () => {
    class Ctrl {
      handler(_fp: string) {}
    }
    Fingerprint()(Ctrl.prototype, 'handler', 0);

    const meta = reflectRouteMetadata(Ctrl.prototype, 'handler');
    const param = meta.parameters.find((p) => p.index === 0);
    expect(param?.type).toBe('fingerprint');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test fingerprint`
Expected: FAIL — `Fingerprint` not exported.

- [ ] **Step 3: Add `'fingerprint'` to `ParamDecoratorType`**

In `src/core/src/types/core/common.ts`, extend the union (it currently ends with `| 'ws';`):
```ts
  | 'ws'
  | 'fingerprint';
```

- [ ] **Step 4: Add the `Fingerprint` decorator in `src/core/src/decorators.ts`**

Append (it already imports `createParamDecorator` from `./utils/core`):
```ts
/**
 * Parameter decorator that injects the request fingerprint.
 *
 * The value is computed lazily from the configured components (default:
 * ip + User-Agent + Accept-Language) and cached in request state, so it works
 * whether or not `@UseFingerprint()` ran first.
 *
 * @example
 * ```ts
 * getData(@Fingerprint() fp: string) {}
 * ```
 */
export const Fingerprint = () => createParamDecorator('fingerprint');
```

- [ ] **Step 5: Wire the arg resolver in `src/core/src/utils/core/controller.ts`**

Add the import (merge with the existing import from `../shared`/local utils — `getOrComputeFingerprint` is exported from the `utils/core` barrel, so import it from there; if controller.ts already imports from a relative `./fingerprint` is also fine):
```ts
import { getOrComputeFingerprint } from './fingerprint';
```
In the arg-resolution loop, alongside the other `param.type` cases (after the `if (param.type === 'response')` block, ~line 85):
```ts
      if (param.type === 'fingerprint') {
        value = getOrComputeFingerprint(request);
      }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn test fingerprint`
Expected: PASS (including the new param-decorator suite).

- [ ] **Step 7: Verify core still type-checks (the resolver edit)**

Run: `yarn build:core`
Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/src/types/core/common.ts src/core/src/decorators.ts src/core/src/utils/core/controller.ts __tests__/core/fingerprint.test.ts
git commit -m "feat(core): add @Fingerprint param decorator and resolver wiring"
```

---

### Task 3: `@UseFingerprint()` attach decorator (`middlewares`)

**Files:**
- Create: `src/middlewares/src/fingerprint.ts`
- Modify: `src/middlewares/src/index.ts`
- Test: `__tests__/middlewares/use-fingerprint.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/middlewares/use-fingerprint.test.ts`**

```ts
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { UseFingerprint } from '@heliosjs/middlewares';
import { reflectMiddlewaresMetadata, setFingerprintConfig } from '@heliosjs/core/utils';
import type { MiddlewareCB, Request } from '@heliosjs/core/types';

function makeReq(
  opts: { ip?: string; userAgent?: string; headers?: Record<string, string | string[]> } = {},
): Request {
  const state = new Map<string, unknown>();
  const headers = opts.headers ?? {};
  return {
    userAgent: opts.userAgent ?? '',
    getClientIp: () => opts.ip ?? '',
    getHeader: (name: string) => headers[name.toLowerCase()],
    getState: <T>(key: string) => state.get(key) as T | undefined,
    setState: (key: string, value: unknown) => {
      state.set(key, value);
    },
  } as unknown as Request;
}

afterEach(() => setFingerprintConfig(undefined));

describe('UseFingerprint decorator', () => {
  it('registers a middleware that attaches the fingerprint and calls next', async () => {
    class Ctrl {}
    UseFingerprint()(Ctrl);

    const meta = reflectMiddlewaresMetadata(Ctrl) ?? [];
    expect(meta.length).toBe(1);
    const mw = meta[0].middleware as MiddlewareCB;

    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA', headers: { 'accept-language': 'en' } });
    let nextCalled = false;
    await mw(req, {} as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.getState('fingerprint')).toBe(
      createHash('sha256').update('1.1.1.1|UA|en').digest('hex'),
    );
  });

  it('applies a per-decorator component override', async () => {
    class Ctrl {}
    UseFingerprint({ components: ['userAgent'] })(Ctrl);

    const mw = (reflectMiddlewaresMetadata(Ctrl) ?? [])[0].middleware as MiddlewareCB;
    const req = makeReq({ ip: '1.1.1.1', userAgent: 'UA' });
    await mw(req, {} as never, () => {});

    expect(req.getState('fingerprint')).toBe(createHash('sha256').update('UA').digest('hex'));
  });

  it('registers on a method when applied at method level', () => {
    class Ctrl {
      handler() {}
    }
    UseFingerprint()(Ctrl.prototype, 'handler');

    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler') ?? [];
    expect(meta.length).toBe(1);
    expect(typeof meta[0].middleware).toBe('function');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test use-fingerprint`
Expected: FAIL — `UseFingerprint` not exported.

- [ ] **Step 3: Create `src/middlewares/src/fingerprint.ts`**

Mirrors `use.ts` (uses the `propertyKey` branch for class-vs-method):
```ts
import type {
  FingerprintComponent,
  MiddlewareCB,
} from '@heliosjs/core/types';
import { defineMiddlewaresMeta, getOrComputeFingerprint } from '@heliosjs/core/utils';

export interface UseFingerprintOptions {
  components?: FingerprintComponent[];
}

/**
 * Controller/method decorator that computes the request fingerprint and attaches
 * it to request state (`getState('fingerprint')`) so downstream guards and
 * interceptors can read it. Non-blocking. Optional `components` overrides the
 * configured/default component set for this scope.
 *
 * @example
 * @UseFingerprint()
 * class MyController {}
 */
export function UseFingerprint(options: UseFingerprintOptions = {}) {
  const middleware: MiddlewareCB = (req, _res, next) => {
    getOrComputeFingerprint(req, options.components);
    return next();
  };

  return function (target: any, propertyKey?: string) {
    const data = [{ middleware }];
    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
    return target;
  };
}
```

- [ ] **Step 4: Export from `src/middlewares/src/index.ts`**

Add (keep alphabetical with the existing `export * from './...'` lines — sits between `'./cors'` and `'./guard'`):
```ts
export * from './fingerprint';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test use-fingerprint`
Expected: PASS (all three cases).

- [ ] **Step 6: Run the full suite**

Run: `yarn test`
Expected: PASS — existing suites + fingerprint + use-fingerprint.

- [ ] **Step 7: Commit**

```bash
git add src/middlewares/src/fingerprint.ts src/middlewares/src/index.ts __tests__/middlewares/use-fingerprint.test.ts
git commit -m "feat(middlewares): add UseFingerprint attach decorator"
```

---

### Task 4: Config wiring (`http` + `aws`)

**Files:**
- Modify: `src/http/src/types/http/http.ts`
- Modify: `src/http/src/Helios.ts`
- Modify: `src/aws/src/types/aws/lambda.ts`
- Modify: `src/aws/src/lambda.ts`

- [ ] **Step 1: Add `ServerConfig.fingerprint` in `src/http/src/types/http/http.ts`**

Add `FingerprintConfig` to the existing `@heliosjs/core/types` import (it already imports `RBACConfig`):
```ts
import type { FingerprintConfig, RBACConfig } from '@heliosjs/core/types';
```
Add this field inside `ServerConfig` (right after the `rbac?: RBACConfig;` field):
```ts
  /**
   * Request fingerprinting configuration consumed by `@Fingerprint()` / `@UseFingerprint()`.
   */
  fingerprint?: FingerprintConfig;
```

- [ ] **Step 2: Register at http bootstrap in `src/http/src/Helios.ts`**

Add `setFingerprintConfig` to the existing `@heliosjs/core/utils` import (it already imports `setRolesExtractor`):
```ts
import { setFingerprintConfig, setRolesExtractor } from '@heliosjs/core/utils';
```
In the constructor, immediately after the existing RBAC registration block (`if (this.config.rbac?.getRoles) { ... }`), add:
```ts
    if (this.config.fingerprint) {
      setFingerprintConfig(this.config.fingerprint);
    }
```

- [ ] **Step 3: Add `LambdaOptions.fingerprint` in `src/aws/src/types/aws/lambda.ts`**

Add `FingerprintConfig` to the existing `@heliosjs/core/types` import (it already imports `RBACConfig`):
```ts
import type { FingerprintConfig, RBACConfig } from '@heliosjs/core/types';
```
Add this field inside `LambdaOptions` (after `rbac?: RBACConfig;`):
```ts
  /** Request fingerprinting configuration consumed by `@Fingerprint()` / `@UseFingerprint()`. */
  fingerprint?: FingerprintConfig;
```

- [ ] **Step 4: Register at aws bootstrap in `src/aws/src/lambda.ts`**

Add `setFingerprintConfig` to the existing `@heliosjs/core/utils` import (it already imports `setRolesExtractor`):
```ts
import { setFingerprintConfig, setRolesExtractor } from '@heliosjs/core/utils';
```
In the constructor, immediately after the existing RBAC registration block (`if (options?.rbac?.getRoles) { ... }`), add:
```ts
    if (options?.fingerprint) {
      setFingerprintConfig(options.fingerprint);
    }
```

- [ ] **Step 5: Build all four packages (cross-package type check)**

Run: `yarn build:core && yarn build:middlewares && yarn build:http && yarn build:aws`
Expected: zero TypeScript errors.

- [ ] **Step 6: Run the full test suite**

Run: `yarn test`
Expected: PASS — all suites.

- [ ] **Step 7: Commit**

```bash
git add src/http/src/types/http/http.ts src/http/src/Helios.ts src/aws/src/types/aws/lambda.ts src/aws/src/lambda.ts
git commit -m "feat(http,aws): wire fingerprint config into Server and Lambda adapters"
```

---

## Final Verification

- [ ] **Full test suite**

Run: `yarn test`
Expected: PASS — all suites (rbac + fingerprint + use-fingerprint).

- [ ] **Build all packages**

Run: `yarn build`
Expected: full monorepo build succeeds.

- [ ] **Manual sanity (optional)**

```ts
@Server({ fingerprint: { secret: process.env.FP_SECRET, components: ['ip', 'userAgent'] } })
class App {}

class UserController {
  @UseFingerprint()
  profile(@Fingerprint() fp: string) {
    return { fp };
  }
}
```
Two requests from the same IP+UA → identical `fp`; differing UA → different `fp`.

## Acceptance Criteria

- `@Fingerprint()` injects the computed fingerprint into a handler param (lazy compute + cache).
- `@UseFingerprint()` attaches the fingerprint to request state at controller or method level, non-blocking; supports a `components` override.
- Composition: default components, per-decorator override, global `components`, and a global `compute` override all honored.
- HMAC-SHA-256 when `secret` configured, else SHA-256; array headers normalized; missing components → `''`.
- Config wired via `@Server({ fingerprint })` (http) and `new Helios(controller, { fingerprint })` (aws), guarded to not clobber across instances.
- All tests pass; monorepo builds.
