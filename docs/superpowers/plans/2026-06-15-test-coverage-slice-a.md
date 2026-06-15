# Test Coverage Slice A — Core Pipeline & Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add characterization tests for the core request pipeline and routing (`matchRoutes`, parsers, `execute`, `beforeRequest`, `runGuard`), plus reusable test builders and a coverage gate.

**Architecture:** These functions already exist and are exported. Tests document their actual behavior (characterization testing): write the test, run it, expect it to PASS against current behavior. Where a test exposes surprising/buggy behavior, encode the ACTUAL behavior and record it as a finding — do not change framework code in this slice. Shared fakes live in one builders module.

**Tech Stack:** TypeScript, Vitest (root runner, `__tests__/`), `@vitest/coverage-v8`, yarn workspaces.

---

## Spec

See `docs/superpowers/specs/2026-06-15-test-coverage-slice-a-design.md`.

## Findings to expect (characterization, not fixes)

- **`matchRoutes` precedence is first-match by declaration order, not specificity.** Each controller's loop `return`s after the first matching route, so `matches` never holds more than one element and the trailing `.sort((a,b)=>a.fullPath...)` comparator is never invoked (dead code; `Route` has no `fullPath`). Tests must assert order-based first-match behavior.
- Record these in the commit message / a short note; fixing them is a separate decision.

## File Structure

| Path                                              | Responsibility                          |
| ------------------------------------------------- | --------------------------------------- |
| `__tests__/helpers/http.ts` (new)                 | shared builders                         |
| `__tests__/core/match.test.ts` (new)              | `matchRoutes`                           |
| `__tests__/core/parsers.test.ts` (new)            | parsers                                 |
| `__tests__/core/pipeline-before-request.test.ts` (new) | `beforeRequest`                    |
| `__tests__/core/pipeline-execute.test.ts` (new)   | `execute`                               |
| `__tests__/core/run-guard.test.ts` (new)          | class/instance `runGuard`               |
| `vitest.config.ts` (modify)                       | coverage block                          |
| `package.json` (modify)                           | `@vitest/coverage-v8` + `test:coverage` |

**Test commands:** all: `yarn test`; one file: `yarn test <name>`; coverage: `yarn test:coverage`.

---

### Task 1: Shared builders + `matchRoutes` tests

**Files:**
- Create: `__tests__/helpers/http.ts`
- Create: `__tests__/core/match.test.ts`

- [ ] **Step 1: Create the builders `__tests__/helpers/http.ts`**

```ts
import type { ControllerMeta, Request, Response, Route } from "@heliosjs/core/types";

export function makeRequest(overrides: Record<string, any> = {}): Request {
  const state = new Map<string, unknown>();
  const headers: Record<string, string | string[]> = overrides.headers ?? {};
  const query: Record<string, unknown> = overrides.query ?? {};
  const params: Record<string, string> = overrides.params ?? {};
  const base: any = {
    method: "GET",
    url: "/",
    path: "/",
    cookies: {},
    isBase64Encoded: false,
    userAgent: "",
    body: undefined,
    rawBody: undefined,
    ...overrides,
    headers,
    query,
    params,
    getHeader: (n: string) => headers[n.toLowerCase()] ?? headers[n],
    getParam: (n: string) => params[n],
    getQuery: (n: string) => query[n],
    getClientIp: () => overrides.ip ?? "127.0.0.1",
    getState: <T>(k: string) => state.get(k) as T | undefined,
    setState: (k: string, v: unknown) => {
      state.set(k, v);
    },
  };
  return base as Request;
}

export interface FakeResponse extends Response {
  errored?: Error;
}

export function makeResponse(): FakeResponse {
  const res: any = {
    status: 200,
    data: undefined,
    errored: undefined,
    error(e: Error) {
      this.errored = e;
    },
  };
  return res as FakeResponse;
}

export function makeRoute(overrides: Record<string, any> = {}): Route {
  return {
    name: "handler",
    route: "/",
    method: "GET",
    parameters: [],
    functions: [],
    fn: () => undefined,
    cors: undefined,
    ...overrides,
  } as unknown as Route;
}

export function makeControllerMeta(overrides: Record<string, any> = {}): ControllerMeta {
  return {
    prefix: "/",
    name: "root",
    routes: [],
    children: [],
    functions: [],
    controllers: [],
    ...overrides,
  } as unknown as ControllerMeta;
}
```

- [ ] **Step 2: Write `__tests__/core/match.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { matchRoutes } from "@heliosjs/core/utils";
import { makeControllerMeta, makeRoute } from "../helpers/http";

const meta = (routes: any[]) => makeControllerMeta({ routes });

describe("matchRoutes", () => {
  it("matches a static route by path and method", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/users", "GET")).toBe(r);
  });

  it("matches a parameterized route", () => {
    const r = makeRoute({ route: "/users/:id", method: "GET" });
    expect(matchRoutes(meta([r]), "/users/5", "GET")).toBe(r);
  });

  it("matches a wildcard route", () => {
    const r = makeRoute({ route: "/files/*", method: "GET" });
    expect(matchRoutes(meta([r]), "/files/a/b", "GET")).toBe(r);
  });

  it("does not match a different HTTP method", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/users", "POST")).toBeUndefined();
  });

  it("matches any method for an ANY route", () => {
    const r = makeRoute({ route: "/x", method: "ANY" });
    expect(matchRoutes(meta([r]), "/x", "DELETE")).toBe(r);
  });

  it("returns undefined when nothing matches", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/nope", "GET")).toBeUndefined();
  });

  it("returns the FIRST route by declaration order (first-match, not specificity)", () => {
    // FINDING: a wildcard declared before a specific route wins, because the
    // search returns on first match and the specificity sort is dead code.
    const wildcard = makeRoute({ route: "/*", method: "GET", name: "wild" });
    const specific = makeRoute({ route: "/users", method: "GET", name: "specific" });
    expect(matchRoutes(meta([wildcard, specific]), "/users", "GET")).toBe(wildcard);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `yarn test match`
Expected: PASS. If the wildcard/precedence test does not behave as written, encode the ACTUAL result and note it — that is the finding, not a failure to fix.

- [ ] **Step 4: Commit**

```bash
git add __tests__/helpers/http.ts __tests__/core/match.test.ts
git commit -m "test(core): cover matchRoutes routing + add shared http test builders"
```

---

### Task 2: Parser tests

**Files:**
- Create: `__tests__/core/parsers.test.ts`

- [ ] **Step 1: Write `__tests__/core/parsers.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  parseBody,
  parseHeaders,
  parseQuery,
  parseRequestCookie,
} from "@heliosjs/core/utils";

describe("parseQuery", () => {
  it("returns a single value as a string", () => {
    expect(parseQuery(new URL("http://x/?a=1"))).toEqual({ a: "1" });
  });
  it("returns repeated keys as an array", () => {
    expect(parseQuery(new URL("http://x/?b=2&b=3"))).toEqual({ b: ["2", "3"] });
  });
  it("returns an empty object when there is no query", () => {
    expect(parseQuery(new URL("http://x/"))).toEqual({});
  });
});

describe("parseBody", () => {
  it("returns an already-parsed object unchanged", () => {
    const obj = { x: 1 };
    expect(parseBody({ body: obj, headers: {} })).toBe(obj);
  });
  it("returns undefined for an empty body", () => {
    expect(parseBody({ body: "", headers: {} })).toBeUndefined();
    expect(parseBody({ body: undefined, headers: {} })).toBeUndefined();
  });
  it("parses a JSON body", () => {
    expect(
      parseBody({
        body: Buffer.from('{"a":1}'),
        headers: { "content-type": "application/json" },
      }),
    ).toEqual({ a: 1 });
  });
  it("returns the raw string on malformed JSON", () => {
    expect(
      parseBody({
        body: Buffer.from("{bad"),
        headers: { "content-type": "application/json" },
      }),
    ).toBe("{bad");
  });
  it("returns text bodies as a string", () => {
    expect(
      parseBody({ body: Buffer.from("hi"), headers: { "content-type": "text/plain" } }),
    ).toBe("hi");
  });
  it("parses urlencoded bodies, repeated keys as arrays", () => {
    expect(
      parseBody({
        body: Buffer.from("a=1&a=2&b=3"),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    ).toEqual({ a: ["1", "2"], b: "3" });
  });
  it("returns a buffer with no content-type as a utf8 string", () => {
    expect(parseBody({ body: Buffer.from("raw"), headers: {} })).toBe("raw");
  });
});

describe("parseRequestCookie", () => {
  it("parses a cookie header into a map", () => {
    expect(parseRequestCookie("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });
  it("url-decodes values", () => {
    expect(parseRequestCookie("x=%20")).toEqual({ x: " " });
  });
  it("returns an empty object for no cookies", () => {
    expect(parseRequestCookie(undefined)).toEqual({});
  });
});

describe("parseHeaders", () => {
  it("copies defined entries and drops undefined ones", () => {
    expect(parseHeaders({ a: "1", b: undefined })).toEqual({ a: "1" });
  });
  it("returns an empty object when headers are undefined", () => {
    expect(parseHeaders(undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run** `yarn test parsers` → expect PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/core/parsers.test.ts
git commit -m "test(core): cover request body/query/cookie/header parsers"
```

---

### Task 3: `beforeRequest` pipeline tests

**Files:**
- Create: `__tests__/core/pipeline-before-request.test.ts`

- [ ] **Step 1: Write `__tests__/core/pipeline-before-request.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { beforeRequest, ForbiddenError } from "@heliosjs/core/utils";
import { makeRequest, makeResponse, makeRoute } from "../helpers/http";

describe("beforeRequest", () => {
  it("runs a passing guard then a middleware", async () => {
    const req = makeRequest();
    const route = makeRoute({
      functions: [
        { guard: () => true },
        {
          middleware: (r: any, _res: any, next: any) => {
            r.setState("mw", true);
            next();
          },
        },
      ],
    });
    await beforeRequest(req, makeResponse(), route);
    expect(req.getState("mw")).toBe(true);
  });

  it("rejects with ForbiddenError when a guard denies", async () => {
    const route = makeRoute({ functions: [{ guard: () => false }] });
    await expect(
      beforeRequest(makeRequest(), makeResponse(), route),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("runs guards and middleware in declaration order", async () => {
    const order: string[] = [];
    const route = makeRoute({
      functions: [
        {
          guard: () => {
            order.push("guard");
            return true;
          },
        },
        {
          middleware: (_r: any, _res: any, next: any) => {
            order.push("middleware");
            next();
          },
        },
      ],
    });
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(order).toEqual(["guard", "middleware"]);
  });

  it("applies a pipe transform to the request body", async () => {
    const req = makeRequest({ body: { a: 1 } });
    const route = makeRoute({
      functions: [{ pipe: { body: (b: any) => ({ ...b, piped: true }) } }],
    });
    await beforeRequest(req, makeResponse(), route);
    expect(req.body).toEqual({ a: 1, piped: true });
  });

  it("invokes a collected error handler when a later middleware throws", async () => {
    let handled: Error | undefined;
    const route = makeRoute({
      functions: [
        { errorHandler: (err: Error) => { handled = err; } },
        {
          middleware: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(handled?.message).toBe("boom");
  });
});
```

- [ ] **Step 2: Run** `yarn test pipeline-before-request` → expect PASS. If a case encodes different actual behavior, adjust the assertion to match and note it.

- [ ] **Step 3: Commit**

```bash
git add __tests__/core/pipeline-before-request.test.ts
git commit -m "test(core): cover beforeRequest pipeline (guard/pipe/middleware/error)"
```

---

### Task 4: `execute` arg-resolution tests

**Files:**
- Create: `__tests__/core/pipeline-execute.test.ts`

> Note: param types `param`, `query`, `body`, `headers`, `multipart` pass through
> `validate()`, which returns the value unchanged when no DTO is set. The tests
> below use `request`, `response`, and `fingerprint` plus a no-DTO `body` to keep
> assertions clean.

- [ ] **Step 1: Write `__tests__/core/pipeline-execute.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { execute } from "@heliosjs/core/utils";
import { makeRequest, makeResponse, makeRoute } from "../helpers/http";

describe("execute", () => {
  it("calls the handler with (request, response) when there are no params", async () => {
    const route = makeRoute({ route: "/", fn: () => "ok" });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(res.data).toBe("ok");
    expect(res.status).toBe(200);
  });

  it("injects the request for a 'request' param", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "request" }],
      fn: (req: any) => req.method,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/", method: "GET" }), res);
    expect(res.data).toBe("GET");
  });

  it("injects a computed fingerprint for a 'fingerprint' param", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "fingerprint" }],
      fn: (fp: string) => fp,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(typeof res.data).toBe("string");
    expect((res.data as string).length).toBe(64); // sha256 hex
  });

  it("passes a no-DTO 'body' param straight through", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "body" }],
      fn: (b: any) => b,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/", body: { x: 1 } }), res);
    expect(res.data).toEqual({ x: 1 });
  });

  it("applies the configured status", async () => {
    const route = makeRoute({ route: "/", functions: [{ status: 201 }], fn: () => "x" });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(res.status).toBe(201);
  });

  it("applies interceptors to the handler result", async () => {
    const route = makeRoute({
      route: "/",
      functions: [{ interceptor: (data: any) => ({ ...data, wrapped: true }) }],
      fn: () => ({ a: 1 }),
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(res.data).toEqual({ a: 1, wrapped: true });
  });
});
```

- [ ] **Step 2: Run** `yarn test pipeline-execute` → expect PASS. Encode actual behavior + note any surprise.

- [ ] **Step 3: Commit**

```bash
git add __tests__/core/pipeline-execute.test.ts
git commit -m "test(core): cover execute argument resolution, status, interceptors"
```

---

### Task 5: `runGuard` class/instance tests

**Files:**
- Create: `__tests__/core/run-guard.test.ts`

> Function-guard cases already exist in `__tests__/middlewares/runGuard.test.ts`.
> This adds the class and instance forms.

- [ ] **Step 1: Write `__tests__/core/run-guard.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ForbiddenError, runGuard } from "@heliosjs/core/utils";
import type { Request, Response } from "@heliosjs/core/types";

const req = {} as Request;
const res = {} as Response;

describe("runGuard (class and instance guards)", () => {
  it("allows when a class guard's canActivate returns true", async () => {
    class AllowGuard {
      canActivate() {
        return true;
      }
    }
    await expect(runGuard(AllowGuard, req, res)).resolves.toBeUndefined();
  });

  it("rejects with ForbiddenError when a class guard denies", async () => {
    class DenyGuard {
      canActivate() {
        return false;
      }
    }
    await expect(runGuard(DenyGuard, req, res)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("uses an instance guard's message on denial", async () => {
    const guard = { canActivate: () => false, message: "nope" };
    await expect(runGuard(guard, req, res)).rejects.toThrow("nope");
  });

  it("allows when an instance guard's canActivate returns true", async () => {
    const guard = { canActivate: () => true };
    await expect(runGuard(guard, req, res)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `yarn test run-guard` → expect PASS.

- [ ] **Step 3: Run the full suite** `yarn test` → expect PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add __tests__/core/run-guard.test.ts
git commit -m "test(core): cover class and instance guards in runGuard"
```

---

### Task 6: Coverage gate

**Files:**
- Modify: `package.json` (root)
- Modify: `vitest.config.ts` (root)

- [ ] **Step 1: Add the coverage provider**

Run: `yarn add -D -W @vitest/coverage-v8`
Expected: `@vitest/coverage-v8` added to root `devDependencies` (a version matching the installed Vitest major — Vitest 4).

- [ ] **Step 2: Add the `test:coverage` script to root `package.json`**

In `"scripts"`, add:
```json
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Add the coverage block to `vitest.config.ts`**

Inside the `test: { ... }` object, add a `coverage` key scoped to the Slice-A files:
```ts
    coverage: {
      provider: "v8",
      all: true,
      include: [
        "src/core/src/utils/core/match.ts",
        "src/core/src/utils/shared/parsers.ts",
        "src/core/src/utils/core/controller.ts",
      ],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 70 },
    },
```

- [ ] **Step 4: Measure and finalize thresholds**

Run: `yarn test:coverage`
Read the coverage table for the three included files. If the run FAILS the thresholds, lower each failing metric in `vitest.config.ts` to the achieved value rounded DOWN to the nearest 5 (the gate must pass on a real number, never an aspirational one). If it passes comfortably, you may raise a metric up to the achieved value rounded down to the nearest 5. Re-run `yarn test:coverage` until it passes.

Expected (final): `yarn test:coverage` exits 0 and prints coverage for the three files at or above the configured thresholds.

- [ ] **Step 5: CI wiring (advisory)**

This repo's only workflow is `.github/workflows/publish.yml` (release) — there is no test CI job in this tree to attach to. The gate is enforced by the `test:coverage` script + thresholds. In your report, surface one line for the maintainer: "CI test job should run `yarn test:coverage` (it fails under the coverage thresholds)." Do NOT fabricate a new CI workflow in this task.

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock vitest.config.ts
git commit -m "test: add v8 coverage gate scoped to core pipeline + routing"
```

---

## Final Verification

- [ ] **Full suite** — Run: `yarn test` → all suites PASS.
- [ ] **Coverage gate** — Run: `yarn test:coverage` → exits 0, meets thresholds for the three included files.
- [ ] **Findings recorded** — the `matchRoutes` first-match/dead-sort finding is captured in `match.test.ts` (comment) and the commit message. Surface it (plus any new ones) to the maintainer as candidate follow-up fixes.

## Acceptance Criteria

- `matchRoutes`, the four parsers, `execute`, `beforeRequest`, and class/instance `runGuard` are covered by characterization tests; `yarn test` is green.
- Reusable builders exist in `__tests__/helpers/http.ts`.
- `@vitest/coverage-v8` installed; `test:coverage` script + scoped coverage thresholds pass on real numbers.
- The `matchRoutes` precedence/dead-sort finding is documented, not silently changed.
