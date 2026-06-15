# Rate Limit Strategies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pluggable rate-limiting subsystem to HeliosJS `core` — a `@RateLimit` decorator backed by swappable strategies/stores, with three built-in algorithms and an in-memory default.

**Architecture:** Two-level extension seam. `RateLimitStrategy.consume(key, ctx)` owns the algorithm; `RateLimitStore.get/set/reset` owns the backend. Built-in strategies (`fixedWindow`, `slidingWindow`, `tokenBucket`) implement `get → compute → set` over a generic `{ count, resetAt }` state. `MemoryStore` is the zero-dep default. `@RateLimit` stores a `rateLimit` metadata item (method- and class-level); a new `enforceRateLimit` step at the top of `beforeRequest` resolves precedence (method > controller > global), calls the strategy, sets `X-RateLimit-*` headers, and throws `RateLimitExceededError` (429) on breach.

**Tech Stack:** TypeScript, vitest, reflect-metadata. Tests live in `__tests__/`, imported via the `@heliosjs/core`, `@heliosjs/core/utils`, `@heliosjs/core/types` aliases (see `vitest.config.ts`).

---

## File Structure

**Created:**
- `src/core/src/types/core/ratelimit.ts` — all rate-limit interfaces.
- `src/core/src/utils/core/ratelimit/store.ts` — `MemoryStore`.
- `src/core/src/utils/core/ratelimit/strategies.ts` — `fixedWindow`, `slidingWindow`, `tokenBucket`, `getDefaultStrategy`.
- `src/core/src/utils/core/ratelimit/config.ts` — `set/getRateLimitConfig`.
- `src/core/src/utils/core/ratelimit/enforce.ts` — `enforceRateLimit`.
- `src/core/src/utils/core/ratelimit/index.ts` — barrel.
- Tests: `__tests__/core/ratelimit-store.test.ts`, `ratelimit-fixed-window.test.ts`, `ratelimit-sliding-window.test.ts`, `ratelimit-token-bucket.test.ts`, `ratelimit-config.test.ts`, `ratelimit-enforce.test.ts`, `ratelimit-decorator.test.ts`, `ratelimit-integration.test.ts`.

**Modified:**
- `src/core/src/types/core/controller.ts` — add `rateLimit` to the middleware item enum/union/map.
- `src/core/src/types/core/index.ts` — re-export `./ratelimit`.
- `src/core/src/utils/core/index.ts` — re-export `./ratelimit`.
- `src/core/src/decorators.ts` — add `RateLimit` decorator.
- `src/core/src/utils/core/controller.ts` — call `enforceRateLimit` in `beforeRequest`.
- `src/core/src/index.ts` — public exports.
- `__tests__/helpers/http.ts` — add `setHeader`/`setHeaders` to the fake response.

---

## Task 1: Types foundation

**Files:**
- Create: `src/core/src/types/core/ratelimit.ts`
- Modify: `src/core/src/types/core/index.ts`
- Modify: `src/core/src/types/core/controller.ts:186-220`

- [ ] **Step 1: Create the types file**

Create `src/core/src/types/core/ratelimit.ts`:

```ts
import type { Request } from './request';
import type { Response } from './response';

/** Result of a single rate-limit check. */
export interface RateLimitRecord {
  /** Hits used in the current window (or tokens consumed). */
  totalHits: number;
  /** max - used, clamped to >= 0. */
  remaining: number;
  /** Epoch ms when the limit next eases (window end / refill). */
  resetAt: number;
  /** Whether THIS request is permitted. */
  allowed: boolean;
}

/**
 * Generic numeric state for one key. Meaning is strategy-defined:
 * fixed/sliding window -> count = hits used; token bucket -> count = tokens
 * left (fractional); resetAt -> window end OR last-refill timestamp (epoch ms).
 */
export interface RateLimitState {
  count: number;
  resetAt: number;
}

/** Low-level pluggable backend: a generic per-key state store with TTL eviction. */
export interface RateLimitStore {
  get(key: string): Promise<RateLimitState | undefined>;
  set(key: string, state: RateLimitState, ttlMs: number): Promise<void>;
  reset(key: string): Promise<void>;
}

/** Per-request inputs handed to a strategy. */
export interface RateLimitContext {
  request: Request;
  max: number;
  windowMs: number;
  cost: number;
}

/** High-level extension point: owns the limiting algorithm. */
export interface RateLimitStrategy {
  consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord>;
}

/** Options accepted by the `@RateLimit` decorator. */
export interface RateLimitOptions {
  max: number;
  windowMs: number;
  strategy?: RateLimitStrategy;
  keyGen?: (req: Request) => string;
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
  cost?: number;
}

/** Global defaults (max/windowMs always come from the decorator). */
export interface RateLimitConfig {
  strategy?: RateLimitStrategy;
  keyGen?: (req: Request) => string;
  onLimit?: (req: Request, res: Response) => void | Promise<void>;
}
```

- [ ] **Step 2: Re-export from the types barrel**

In `src/core/src/types/core/index.ts`, add alongside the existing exports (after the `./rbac` line):

```ts
export * from './ratelimit';
```

- [ ] **Step 3: Add the `rateLimit` middleware item type**

In `src/core/src/types/core/controller.ts`, first add an import at the top of the file (near the other type imports):

```ts
import type { RateLimitOptions } from './ratelimit';
```

Then in the `MiddlewaresMetadataItemProperty` enum (around line 186) add the member:

```ts
  rateLimit = 'rateLimit',
```

In the `MiddleWareItemType` union (around line 197) add `'rateLimit'`:

```ts
export type MiddleWareItemType =
  | 'middleware'
  | 'errorHandler'
  | 'cors'
  | 'pipe'
  | 'guard'
  | 'interceptor'
  | 'status'
  | 'sanitizer'
  | 'rateLimit';
```

And in the `MiddlewareTypeMap` interface (around line 207) add:

```ts
  rateLimit: RateLimitOptions;
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx tsc -p src/core/tsconfig.json --noEmit`
Expected: PASS (no errors). If `src/core/tsconfig.json` does not exist, run `npx tsc --noEmit -p src/core` or the repo's `npm run build` for the core package — confirm no new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/src/types/core/ratelimit.ts src/core/src/types/core/index.ts src/core/src/types/core/controller.ts
git commit -m "feat(ratelimit): add rate-limit type interfaces"
```

---

## Task 2: MemoryStore

**Files:**
- Create: `src/core/src/utils/core/ratelimit/store.ts`
- Test: `__tests__/core/ratelimit-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@heliosjs/core/utils';

describe('MemoryStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns undefined for an unknown key', async () => {
    const store = new MemoryStore();
    expect(await store.get('missing')).toBeUndefined();
  });

  it('stores and returns a copy of the state', async () => {
    const store = new MemoryStore();
    const state = { count: 3, resetAt: Date.now() + 1000 };
    await store.set('k', state, 1000);
    const got = await store.get('k');
    expect(got).toEqual(state);
    expect(got).not.toBe(state); // defensive copy
  });

  it('evicts an entry lazily after its ttl elapses', async () => {
    const store = new MemoryStore();
    await store.set('k', { count: 1, resetAt: Date.now() + 50 }, 50);
    vi.advanceTimersByTime(51);
    expect(await store.get('k')).toBeUndefined();
  });

  it('reset() drops the entry', async () => {
    const store = new MemoryStore();
    await store.set('k', { count: 1, resetAt: Date.now() + 1000 }, 1000);
    await store.reset('k');
    expect(await store.get('k')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-store.test.ts`
Expected: FAIL — `MemoryStore` is not exported / not defined.

- [ ] **Step 3: Write the implementation**

Create `src/core/src/utils/core/ratelimit/store.ts`:

```ts
import type { RateLimitState, RateLimitStore } from '../../../types/core/ratelimit';

interface Entry {
  state: RateLimitState;
  expireAt: number;
}

/**
 * In-memory, single-process rate-limit store. Entries are evicted lazily on
 * access once their TTL has elapsed — no background timer, so it never keeps
 * the process alive. Not distributed; swap for a Redis-backed store across
 * multiple instances.
 */
export class MemoryStore implements RateLimitStore {
  private readonly map = new Map<string, Entry>();

  async get(key: string): Promise<RateLimitState | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expireAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return { ...entry.state };
  }

  async set(key: string, state: RateLimitState, ttlMs: number): Promise<void> {
    this.map.set(key, { state: { ...state }, expireAt: Date.now() + ttlMs });
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }
}
```

- [ ] **Step 4: Create the barrel and wire the utils export**

Create `src/core/src/utils/core/ratelimit/index.ts`:

```ts
export * from './store';
```

In `src/core/src/utils/core/index.ts`, add (keep the list alphabetical-ish, after `./rbac`):

```ts
export * from './ratelimit';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/src/utils/core/ratelimit/store.ts src/core/src/utils/core/ratelimit/index.ts src/core/src/utils/core/index.ts __tests__/core/ratelimit-store.test.ts
git commit -m "feat(ratelimit): add in-memory store with lazy expiry"
```

---

## Task 3: Config holder

**Files:**
- Create: `src/core/src/utils/core/ratelimit/config.ts`
- Modify: `src/core/src/utils/core/ratelimit/index.ts`
- Test: `__tests__/core/ratelimit-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-config.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { getRateLimitConfig, setRateLimitConfig } from '@heliosjs/core/utils';

afterEach(() => setRateLimitConfig(undefined));

describe('rate-limit config holder', () => {
  it('is undefined by default', () => {
    expect(getRateLimitConfig()).toBeUndefined();
  });

  it('stores and returns the config', () => {
    const cfg = { keyGen: () => 'k' };
    setRateLimitConfig(cfg);
    expect(getRateLimitConfig()).toBe(cfg);
  });

  it('clears when set to undefined', () => {
    setRateLimitConfig({ keyGen: () => 'k' });
    setRateLimitConfig(undefined);
    expect(getRateLimitConfig()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-config.test.ts`
Expected: FAIL — `setRateLimitConfig`/`getRateLimitConfig` not exported.

- [ ] **Step 3: Write the implementation**

Create `src/core/src/utils/core/ratelimit/config.ts`:

```ts
import type { RateLimitConfig } from '../../../types/core/ratelimit';

let config: RateLimitConfig | undefined;

export function setRateLimitConfig(cfg: RateLimitConfig | undefined): void {
  config = cfg;
}

export function getRateLimitConfig(): RateLimitConfig | undefined {
  return config;
}
```

Add to `src/core/src/utils/core/ratelimit/index.ts`:

```ts
export * from './config';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/utils/core/ratelimit/config.ts src/core/src/utils/core/ratelimit/index.ts __tests__/core/ratelimit-config.test.ts
git commit -m "feat(ratelimit): add global config holder"
```

---

## Task 4: fixedWindow strategy

**Files:**
- Create: `src/core/src/utils/core/ratelimit/strategies.ts`
- Modify: `src/core/src/utils/core/ratelimit/index.ts`
- Test: `__tests__/core/ratelimit-fixed-window.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-fixed-window.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedWindow, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 2,
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('fixedWindow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to max then blocks', async () => {
    const s = fixedWindow(new MemoryStore());
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    const third = await s.consume('k', ctx());
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('reports remaining and resetAt', async () => {
    const s = fixedWindow(new MemoryStore());
    const r = await s.consume('k', ctx({ max: 5 }));
    expect(r.remaining).toBe(4);
    expect(r.resetAt).toBe(Date.now() + 1000);
  });

  it('resets after the window elapses', async () => {
    const s = fixedWindow(new MemoryStore());
    await s.consume('k', ctx());
    await s.consume('k', ctx());
    expect((await s.consume('k', ctx())).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
  });

  it('defaults to an internal MemoryStore when none is given', async () => {
    const s = fixedWindow();
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(true);
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-fixed-window.test.ts`
Expected: FAIL — `fixedWindow` not exported.

- [ ] **Step 3: Write the implementation**

Create `src/core/src/utils/core/ratelimit/strategies.ts`:

```ts
import type {
  RateLimitContext,
  RateLimitRecord,
  RateLimitStore,
  RateLimitStrategy,
} from '../../../types/core/ratelimit';
import { MemoryStore } from './store';

/**
 * Fixed-window counter. One key per limit; the counter resets hard at the end
 * of each `windowMs` window.
 */
export function fixedWindow(store: RateLimitStore = new MemoryStore()): RateLimitStrategy {
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      let state = await store.get(key);
      if (!state || state.resetAt <= now) {
        state = { count: 0, resetAt: now + ctx.windowMs };
      }
      state.count += ctx.cost;
      await store.set(key, state, state.resetAt - now);

      const remaining = Math.max(0, ctx.max - state.count);
      return {
        totalHits: state.count,
        remaining,
        resetAt: state.resetAt,
        allowed: state.count <= ctx.max,
      };
    },
  };
}
```

Add to `src/core/src/utils/core/ratelimit/index.ts`:

```ts
export * from './strategies';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-fixed-window.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/utils/core/ratelimit/strategies.ts src/core/src/utils/core/ratelimit/index.ts __tests__/core/ratelimit-fixed-window.test.ts
git commit -m "feat(ratelimit): add fixed-window strategy"
```

---

## Task 5: slidingWindow strategy

**Files:**
- Modify: `src/core/src/utils/core/ratelimit/strategies.ts`
- Test: `__tests__/core/ratelimit-sliding-window.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-sliding-window.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slidingWindow, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 2,
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('slidingWindow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to max within one window', async () => {
    // Align to a window boundary so weighting from the previous window is zero.
    vi.setSystemTime(2000);
    const s = slidingWindow(new MemoryStore());
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(true);
    expect((await s.consume('k', ctx())).allowed).toBe(false);
  });

  it('blocks a boundary burst that a fixed window would allow', async () => {
    vi.setSystemTime(2000); // start of window [2000, 3000)
    const s = slidingWindow(new MemoryStore());
    await s.consume('k', ctx({ max: 2 })); // current window count -> 1
    await s.consume('k', ctx({ max: 2 })); // current window count -> 2 (full)

    vi.setSystemTime(3001); // 1ms into the next window [3000, 4000)
    // prevWeight ~= (1000 - 1) / 1000 = 0.999
    // estimated ~= prev(2) * 0.999 + curr(1) ~= 2.998 > 2 -> blocked
    const r = await s.consume('k', ctx({ max: 2 }));
    expect(r.allowed).toBe(false);
  });

  it('reports a resetAt at the end of the current window', async () => {
    vi.setSystemTime(2000);
    const s = slidingWindow(new MemoryStore());
    const r = await s.consume('k', ctx());
    expect(r.resetAt).toBe(3000); // currStart(2000) + windowMs(1000)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-sliding-window.test.ts`
Expected: FAIL — `slidingWindow` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/core/src/utils/core/ratelimit/strategies.ts`:

```ts
/**
 * Sliding-window counter approximated from two adjacent fixed windows. The
 * previous window's count is weighted by the fraction of it still inside the
 * sliding view, smoothing the boundary bursts a fixed window allows. Uses two
 * time-bucketed sub-keys (`<key>:<windowStart>`).
 */
export function slidingWindow(store: RateLimitStore = new MemoryStore()): RateLimitStrategy {
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      const windowMs = ctx.windowMs;
      const currStart = Math.floor(now / windowMs) * windowMs;
      const prevStart = currStart - windowMs;
      const currKey = `${key}:${currStart}`;
      const prevKey = `${key}:${prevStart}`;

      const curr = (await store.get(currKey)) ?? { count: 0, resetAt: currStart + windowMs };
      const prev = (await store.get(prevKey)) ?? { count: 0, resetAt: prevStart + windowMs };

      curr.count += ctx.cost;
      // Keep current long enough to act as "previous" during the next window.
      await store.set(currKey, curr, windowMs * 2);

      const elapsed = now - currStart;
      const prevWeight = (windowMs - elapsed) / windowMs;
      const estimated = prev.count * prevWeight + curr.count;

      const remaining = Math.max(0, Math.floor(ctx.max - estimated));
      return {
        totalHits: Math.ceil(estimated),
        remaining,
        resetAt: currStart + windowMs,
        allowed: estimated <= ctx.max,
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-sliding-window.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/utils/core/ratelimit/strategies.ts __tests__/core/ratelimit-sliding-window.test.ts
git commit -m "feat(ratelimit): add sliding-window strategy"
```

---

## Task 6: tokenBucket strategy

**Files:**
- Modify: `src/core/src/utils/core/ratelimit/strategies.ts`
- Test: `__tests__/core/ratelimit-token-bucket.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-token-bucket.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenBucket, MemoryStore } from '@heliosjs/core/utils';
import type { Request } from '@heliosjs/core/types';

const ctx = (over: Partial<{ max: number; windowMs: number; cost: number }> = {}) => ({
  request: {} as Request,
  max: over.max ?? 3, // capacity
  windowMs: over.windowMs ?? 1000,
  cost: over.cost ?? 1,
});

describe('tokenBucket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows a burst up to capacity then blocks', async () => {
    const s = tokenBucket(new MemoryStore(), { refillRate: 1 });
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 3 -> 2
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 2 -> 1
    expect((await s.consume('k', ctx())).allowed).toBe(true);  // 1 -> 0
    expect((await s.consume('k', ctx())).allowed).toBe(false); // empty
  });

  it('refills over time at refillRate tokens/sec', async () => {
    const s = tokenBucket(new MemoryStore(), { refillRate: 2 }); // 2 tokens/sec
    await s.consume('k', ctx({ max: 1 })); // capacity 1 -> empty
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(false);
    vi.advanceTimersByTime(500); // 0.5s * 2 = 1 token
    expect((await s.consume('k', ctx({ max: 1 }))).allowed).toBe(true);
  });

  it('consumes multiple tokens when cost > 1', async () => {
    const s = tokenBucket(new MemoryStore(), { refillRate: 1 });
    const r = await s.consume('k', ctx({ max: 3, cost: 2 })); // 3 -> 1
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
    expect((await s.consume('k', ctx({ max: 3, cost: 2 }))).allowed).toBe(false); // only 1 left
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-token-bucket.test.ts`
Expected: FAIL — `tokenBucket` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/core/src/utils/core/ratelimit/strategies.ts`:

```ts
export interface TokenBucketOptions {
  /** Tokens added per second. */
  refillRate: number;
}

/**
 * Token bucket: `max` is the bucket capacity, `refillRate` tokens are added per
 * second up to capacity. Permits bursts up to capacity. `state.count` holds the
 * (fractional) tokens available; `state.resetAt` holds the last-refill timestamp.
 */
export function tokenBucket(
  store: RateLimitStore = new MemoryStore(),
  options: TokenBucketOptions,
): RateLimitStrategy {
  const { refillRate } = options;
  return {
    async consume(key: string, ctx: RateLimitContext): Promise<RateLimitRecord> {
      const now = Date.now();
      const capacity = ctx.max;
      const cost = ctx.cost;

      let state = await store.get(key);
      if (!state) {
        state = { count: capacity, resetAt: now };
      }
      // Refill based on elapsed time since the last refill.
      const elapsedSec = (now - state.resetAt) / 1000;
      state.count = Math.min(capacity, state.count + elapsedSec * refillRate);
      state.resetAt = now;

      const allowed = state.count >= cost;
      if (allowed) {
        state.count -= cost;
      }

      // TTL: long enough for the bucket to fully refill.
      const ttlMs = Math.ceil((capacity / refillRate) * 1000);
      await store.set(key, state, ttlMs);

      // resetAt header value: when the limit next eases.
      const deficit = allowed
        ? capacity - state.count // time to refill to full
        : cost - state.count; // time until this request could succeed
      const easeMs = deficit > 0 ? Math.ceil((deficit / refillRate) * 1000) : 0;

      return {
        totalHits: capacity - Math.floor(state.count),
        remaining: Math.floor(state.count),
        resetAt: now + easeMs,
        allowed,
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-token-bucket.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/utils/core/ratelimit/strategies.ts __tests__/core/ratelimit-token-bucket.test.ts
git commit -m "feat(ratelimit): add token-bucket strategy"
```

---

## Task 7: getDefaultStrategy + enforceRateLimit

**Files:**
- Modify: `src/core/src/utils/core/ratelimit/strategies.ts`
- Create: `src/core/src/utils/core/ratelimit/enforce.ts`
- Modify: `src/core/src/utils/core/ratelimit/index.ts`
- Modify: `__tests__/helpers/http.ts`
- Test: `__tests__/core/ratelimit-enforce.test.ts`

- [ ] **Step 1: Add setHeader/setHeaders to the fake response helper**

In `__tests__/helpers/http.ts`, change `makeResponse` so the fake records headers:

```ts
export interface FakeResponse extends Response {
  errored?: Error;
  headers: Record<string, string | string[]>;
}

export function makeResponse(): FakeResponse {
  const res: any = {
    status: 200,
    data: undefined,
    errored: undefined,
    headers: {},
    error(e: Error) {
      this.errored = e;
    },
    setHeader(name: string, value: string | string[]) {
      this.headers[name] = value;
      return this;
    },
    setHeaders(headers: Record<string, string | string[]>) {
      Object.assign(this.headers, headers);
      return this;
    },
  };
  return res as FakeResponse;
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/core/ratelimit-enforce.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enforceRateLimit,
  RateLimitExceededError,
  setRateLimitConfig,
} from '@heliosjs/core/utils';
import type { RateLimitRecord, RateLimitStrategy } from '@heliosjs/core/types';
import { makeRequest, makeResponse, makeRoute } from '../helpers/http';

afterEach(() => setRateLimitConfig(undefined));

function fakeStrategy(record: RateLimitRecord): RateLimitStrategy & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    async consume(key, ctx) {
      calls.push({ key, ctx });
      return record;
    },
  };
}

const allow: RateLimitRecord = { totalHits: 1, remaining: 4, resetAt: 10_000, allowed: true };
const deny: RateLimitRecord = { totalHits: 6, remaining: 0, resetAt: 10_000, allowed: false };

describe('enforceRateLimit', () => {
  it('does nothing when there is no rateLimit item and no global config', async () => {
    const res = makeResponse();
    await enforceRateLimit(makeRequest(), res, makeRoute());
    expect(res.headers).toEqual({});
  });

  it('sets X-RateLimit headers on an allowed request', async () => {
    const strategy = fakeStrategy(allow);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy } }],
    });
    const res = makeResponse();
    await enforceRateLimit(makeRequest(), res, route);
    expect(res.headers['X-RateLimit-Limit']).toBe('5');
    expect(res.headers['X-RateLimit-Remaining']).toBe('4');
    expect(res.headers['X-RateLimit-Reset']).toBe('10');
    expect(res.headers['Retry-After']).toBeUndefined();
  });

  it('throws RateLimitExceededError and sets Retry-After on a denied request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const strategy = fakeStrategy(deny);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy } }],
    });
    const res = makeResponse();
    await expect(enforceRateLimit(makeRequest(), res, route)).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
    expect(res.headers['Retry-After']).toBe('5'); // (10000 - 5000)/1000
    vi.useRealTimers();
  });

  it('invokes onLimit once on a denied request', async () => {
    const onLimit = vi.fn();
    const strategy = fakeStrategy(deny);
    const route = makeRoute({
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy, onLimit } }],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route).catch(() => undefined);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it('lets the method item win over the controller item (precedence)', async () => {
    const controller = fakeStrategy(allow);
    const method = fakeStrategy(allow);
    const route = makeRoute({
      functions: [
        { rateLimit: { max: 100, windowMs: 1000, strategy: controller } }, // controller-level (first)
        { rateLimit: { max: 5, windowMs: 1000, strategy: method } }, // method-level (last)
      ],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(method.calls).toHaveLength(1);
    expect(method.calls[0].ctx.max).toBe(5);
    expect(controller.calls).toHaveLength(0);
  });

  it('uses the global strategy when only global config is set with a decorator', async () => {
    const global = fakeStrategy(allow);
    setRateLimitConfig({ strategy: global });
    const route = makeRoute({ functions: [{ rateLimit: { max: 5, windowMs: 1000 } }] });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(global.calls).toHaveLength(1);
  });

  it('builds the key from keyGen prefixed by the route id', async () => {
    const strategy = fakeStrategy(allow);
    const route = makeRoute({
      method: 'GET',
      route: '/users',
      functions: [{ rateLimit: { max: 5, windowMs: 1000, strategy, keyGen: () => 'abc' } }],
    });
    await enforceRateLimit(makeRequest(), makeResponse(), route);
    expect(strategy.calls[0].key).toBe('GET /users:abc');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-enforce.test.ts`
Expected: FAIL — `enforceRateLimit` not exported.

- [ ] **Step 4: Add getDefaultStrategy**

Append to `src/core/src/utils/core/ratelimit/strategies.ts`:

```ts
let defaultStrategy: RateLimitStrategy | undefined;

/**
 * Lazily-created shared default strategy: a fixed window over a single
 * process-wide MemoryStore. Used when no strategy is configured anywhere.
 */
export function getDefaultStrategy(): RateLimitStrategy {
  if (!defaultStrategy) {
    defaultStrategy = fixedWindow(new MemoryStore());
  }
  return defaultStrategy;
}
```

- [ ] **Step 5: Write the enforce implementation**

Create `src/core/src/utils/core/ratelimit/enforce.ts`:

```ts
import type { Request, Response, Route } from '../../../types/core';
import type { RateLimitOptions, RateLimitStrategy } from '../../../types/core/ratelimit';
import { RateLimitExceededError } from '../error';
import { getOrComputeFingerprint } from '../fingerprint';
import { getRateLimitConfig } from './config';
import { getDefaultStrategy } from './strategies';

/**
 * Resolve and apply rate limiting for a route. Collects all `rateLimit`
 * metadata items (controller-level precede method-level in `route.functions`,
 * so the last one wins), merges strategy/keyGen/onLimit over the global config,
 * runs the strategy, sets `X-RateLimit-*` headers, and throws on breach.
 */
export async function enforceRateLimit(
  request: Request,
  response: Response,
  route: Route,
): Promise<void> {
  const items = route.functions
    .map((fn) => fn.rateLimit)
    .filter((item): item is RateLimitOptions => Boolean(item));

  if (items.length === 0) return; // a decorator is required to define max/windowMs

  const global = getRateLimitConfig();
  let strategy: RateLimitStrategy | undefined = global?.strategy;
  let keyGen = global?.keyGen;
  let onLimit = global?.onLimit;
  let max = 0;
  let windowMs = 0;
  let cost = 1;

  // Apply controller item(s) first, method item last -> method wins.
  for (const item of items) {
    max = item.max;
    windowMs = item.windowMs;
    cost = item.cost ?? cost;
    if (item.strategy) strategy = item.strategy;
    if (item.keyGen) keyGen = item.keyGen;
    if (item.onLimit) onLimit = item.onLimit;
  }

  const effectiveStrategy = strategy ?? getDefaultStrategy();
  const effectiveKeyGen = keyGen ?? ((req: Request) => getOrComputeFingerprint(req));

  const key = `${route.method} ${route.route}:${effectiveKeyGen(request)}`;
  const record = await effectiveStrategy.consume(key, { request, max, windowMs, cost });

  response.setHeaders({
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(record.remaining),
    'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
  });

  if (!record.allowed) {
    const retryAfter = Math.max(0, Math.ceil((record.resetAt - Date.now()) / 1000));
    response.setHeader('Retry-After', String(retryAfter));
    if (onLimit) await onLimit(request, response);
    throw new RateLimitExceededError('Rate limit exceeded', { path: request.path });
  }
}
```

Add to `src/core/src/utils/core/ratelimit/index.ts`:

```ts
export * from './enforce';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-enforce.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/src/utils/core/ratelimit/strategies.ts src/core/src/utils/core/ratelimit/enforce.ts src/core/src/utils/core/ratelimit/index.ts __tests__/helpers/http.ts __tests__/core/ratelimit-enforce.test.ts
git commit -m "feat(ratelimit): add enforce step with precedence and headers"
```

---

## Task 8: @RateLimit decorator

**Files:**
- Modify: `src/core/src/decorators.ts`
- Test: `__tests__/core/ratelimit-decorator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/ratelimit-decorator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RateLimit } from '@heliosjs/core';
import { reflectMiddlewaresMetadata } from '@heliosjs/core/utils';

describe('@RateLimit', () => {
  it('attaches a rateLimit item to method metadata', () => {
    class Ctrl {
      @RateLimit({ max: 5, windowMs: 1000 })
      handler() {}
    }
    const items = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(items).toHaveLength(1);
    expect(items[0].rateLimit).toEqual({ max: 5, windowMs: 1000 });
  });

  it('attaches a rateLimit item to class metadata when used as a class decorator', () => {
    @RateLimit({ max: 10, windowMs: 2000 })
    class Ctrl {}
    const items = reflectMiddlewaresMetadata(Ctrl);
    expect(items).toHaveLength(1);
    expect(items[0].rateLimit).toEqual({ max: 10, windowMs: 2000 });
  });

  it('throws a TypeError for non-positive max or windowMs', () => {
    expect(() => RateLimit({ max: 0, windowMs: 1000 })).toThrow(TypeError);
    expect(() => RateLimit({ max: 5, windowMs: 0 })).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-decorator.test.ts`
Expected: FAIL — `RateLimit` not exported.

- [ ] **Step 3: Write the implementation**

In `src/core/src/decorators.ts`, add the import at the top (next to the existing imports):

```ts
import { defineMiddlewaresMeta } from './utils/shared';
import type { RateLimitOptions } from './types/core/ratelimit';
```

Then append the decorator:

```ts
/**
 * Method or controller decorator that enforces a request rate limit.
 *
 * Validation runs at decoration time; enforcement runs per request. Method-level
 * usage overrides controller-level, which overrides the global config set via
 * `setRateLimitConfig`. The limit key defaults to the request fingerprint.
 *
 * @example
 * ```ts
 * @RateLimit({ max: 100, windowMs: 60_000 })
 * @RateLimit({ max: 10, windowMs: 1000, strategy: slidingWindow(redisStore) })
 * ```
 */
export function RateLimit(options: RateLimitOptions) {
  if (!(options.max > 0)) {
    throw new TypeError('@RateLimit: `max` must be a positive number');
  }
  if (!(options.windowMs > 0)) {
    throw new TypeError('@RateLimit: `windowMs` must be a positive number');
  }

  return function (target: any, propertyKey?: string) {
    const item = { rateLimit: options };
    if (propertyKey) {
      defineMiddlewaresMeta([item], target, propertyKey);
    } else {
      defineMiddlewaresMeta([item], target);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-decorator.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/src/decorators.ts __tests__/core/ratelimit-decorator.test.ts
git commit -m "feat(ratelimit): add @RateLimit decorator"
```

---

## Task 9: Wire into beforeRequest + public exports + integration

**Files:**
- Modify: `src/core/src/utils/core/controller.ts:231-277`
- Modify: `src/core/src/index.ts`
- Test: `__tests__/core/ratelimit-integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/core/ratelimit-integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { beforeRequest, RateLimitExceededError } from '@heliosjs/core/utils';
import { fixedWindow, MemoryStore } from '@heliosjs/core/utils';
import { makeRequest, makeResponse, makeRoute } from '../helpers/http';

describe('rate limiting via beforeRequest', () => {
  it('allows up to max requests then throws on the next', async () => {
    const strategy = fixedWindow(new MemoryStore());
    const route = makeRoute({
      functions: [{ rateLimit: { max: 2, windowMs: 1000, strategy, keyGen: () => 'ip' } }],
    });

    const res1 = makeResponse();
    await beforeRequest(makeRequest(), res1, route);
    expect(res1.headers['X-RateLimit-Remaining']).toBe('1');

    await beforeRequest(makeRequest(), makeResponse(), route);

    await expect(
      beforeRequest(makeRequest(), makeResponse(), route),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it('runs the rate limit before guards', async () => {
    let guardRan = false;
    const strategy = fixedWindow(new MemoryStore());
    const route = makeRoute({
      functions: [
        { rateLimit: { max: 0 + 1, windowMs: 1000, strategy, keyGen: () => 'ip' } },
        {
          guard: () => {
            guardRan = true;
            return true;
          },
        },
      ],
    });
    // First request consumes the only token and passes; guard runs.
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(guardRan).toBe(true);

    // Second request is blocked before the guard.
    guardRan = false;
    await beforeRequest(makeRequest(), makeResponse(), route).catch(() => undefined);
    expect(guardRan).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-integration.test.ts`
Expected: FAIL — `beforeRequest` does not yet enforce rate limits (no throw / guard still runs).

- [ ] **Step 3: Wire enforceRateLimit into beforeRequest**

In `src/core/src/utils/core/controller.ts`, add the import near the other `./` imports at the top:

```ts
import { enforceRateLimit } from './ratelimit';
```

Then change the start of `beforeRequest` (currently at line 231) so enforcement runs first, before the handlers loop:

```ts
export const beforeRequest = async (request: Request, response: Response, route: Route) => {
  await enforceRateLimit(request, response, route);

  const handlers: ErrorHandler[] = [];
  try {
```

(The rest of the function body is unchanged.) Because `enforceRateLimit` runs outside the `try`, a thrown `RateLimitExceededError` propagates to `execute`'s catch, which already whitelists `ErrorCode.RATE_LIMIT_EXCEEDED` (`controller.ts:122-132`) and returns a 429 response.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run __tests__/core/ratelimit-integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add public exports**

In `src/core/src/index.ts`, add the value exports for the decorator and runtime helpers. The `RateLimit` decorator is already re-exported via `export * from './decorators'` (line 11) — confirm it appears. Add the rate-limit utilities and types to the existing explicit export blocks:

In the value export block `export { ... } from './utils/core'` (the one that lists `computeFingerprint`, `setFingerprintConfig`, `RateLimitExceededError`, etc., around line 39), add:

```ts
  fixedWindow,
  slidingWindow,
  tokenBucket,
  getDefaultStrategy,
  MemoryStore,
  setRateLimitConfig,
  getRateLimitConfig,
  enforceRateLimit,
```

In the type export block `export { ... } from './types/core'` (the one that lists `FingerprintConfig`, `RolesExtractor`, etc., around line 13), add:

```ts
  RateLimitOptions,
  RateLimitConfig,
  RateLimitStrategy,
  RateLimitStore,
  RateLimitState,
  RateLimitRecord,
  RateLimitContext,
  TokenBucketOptions,
```

Note: the value helpers live in `./utils/core` (the same block as `RateLimitExceededError`); the type names live in `./types/core`. `TokenBucketOptions` is declared in `strategies.ts` — ensure `utils/core/ratelimit/index.ts` re-exports it (it does via `export * from './strategies'`) and that `./types/core` does not also need it. Since `TokenBucketOptions` is a value-module type, export it from `./utils/core` in the type block or via a separate `export type` line, matching the project's existing convention for types declared in util modules.

- [ ] **Step 6: Run the full test suite**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx vitest run`
Expected: PASS — all existing tests plus the 8 new rate-limit test files green.

- [ ] **Step 7: Type-check the package**

Run: `cd /Users/oleg/Documents/projects/heliosjs/packages && npx tsc -p src/core/tsconfig.json --noEmit` (or the repo's core build command).
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/src/utils/core/controller.ts src/core/src/index.ts __tests__/core/ratelimit-integration.test.ts
git commit -m "feat(ratelimit): enforce in beforeRequest and export public API"
```

---

## Final Verification

- [ ] **All tests pass:** `npx vitest run` — green.
- [ ] **Type-check clean:** `npx tsc -p src/core/tsconfig.json --noEmit` — no errors.
- [ ] **Public API smoke:** `RateLimit`, `fixedWindow`, `slidingWindow`, `tokenBucket`, `MemoryStore`, `setRateLimitConfig` all importable from `@heliosjs/core`.
- [ ] **Manual sanity (optional):** a controller with `@RateLimit({ max: 2, windowMs: 1000 })` returns 429 with `Retry-After` on the third rapid request.

## Notes for the implementer

- The repo aliases `@heliosjs/core` → `src/core/src/index.ts`, `@heliosjs/core/utils` → `src/core/src/utils/index.ts`, `@heliosjs/core/types` → `src/core/src/types/index.ts` (see `vitest.config.ts`). Anything a test imports must be re-exported through those barrels.
- Tests run only files matching `__tests__/**/*.test.ts`.
- `RateLimitExceededError` already exists (`utils/core/error/rateLimit.ts`, 429) and is whitelisted in both catch blocks of `controller.ts` — do not add a new error type.
- Class-level `@RateLimit` relies on `reflect-metadata` walking the prototype chain so the `@Controller`-wrapped subclass still sees the base class metadata, exactly as controller-level guards/middlewares do today.
```
