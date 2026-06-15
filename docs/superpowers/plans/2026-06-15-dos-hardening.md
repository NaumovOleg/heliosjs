# DoS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the HeliosJS HTTP server from memory-exhaustion and slow-connection DoS by adding a configurable request body size limit (returning `413`) and configurable server timeouts.

**Architecture:** A new `PayloadTooLargeError` (413) in `core`; a focused `utils/http/body.ts` whose `collectRawBody` enforces a byte limit from both `content-length` and the live stream; `RequestFactory`/`Helios` thread the configured limit through; `Helios` sets Node `requestTimeout`/`headersTimeout` from config.

**Tech Stack:** TypeScript (nodenext, ES2022), node:http, Vitest (root runner, `__tests__/`), yarn workspaces.

---

## Spec

See `docs/superpowers/specs/2026-06-15-dos-hardening-design.md`.

## File Structure

| Package   | File                                              | Responsibility                                           |
| --------- | ------------------------------------------------- | -------------------------------------------------------- |
| core      | `src/types/core/error.ts` (modify)                | `PAYLOAD_TOO_LARGE` enum member                          |
| core      | `src/utils/core/error/base.ts` (modify)           | `413` case in `getDefaultStatus`                         |
| core      | `src/utils/core/error/payloadTooLarge.ts` (new)   | `PayloadTooLargeError`                                   |
| core      | `src/utils/core/error/index.ts`, `src/index.ts` (modify) | export `PayloadTooLargeError`                     |
| http      | `src/utils/http/body.ts` (new)                    | `collectRawBody` + `DEFAULT_BODY_LIMIT` with size limit  |
| http      | `src/utils/http/server.ts` (modify)               | remove `collectRawBody`                                  |
| http      | `src/utils/http/request.factory.ts` (modify)      | `create(req, maxBytes?)`, import from `./body`           |
| http      | `src/Helios.ts` (modify)                          | pass `config.bodyLimit`; set timeouts                    |
| http      | `src/types/http/http.ts` (modify)                 | `bodyLimit`, `requestTimeout`, `headersTimeout`          |
| __tests__ | `__tests__/core/payload-too-large.test.ts` (new)  | `PayloadTooLargeError` behavior                          |
| __tests__ | `__tests__/http/body-limit.test.ts` (new)         | `collectRawBody` limit behavior                          |

**Test commands** (root Vitest; core source aliased):
- All: `yarn test`
- One file: `yarn test <name>`

---

### Task 1: `PayloadTooLargeError` (core)

**Files:**
- Modify: `src/core/src/types/core/error.ts`
- Modify: `src/core/src/utils/core/error/base.ts`
- Create: `src/core/src/utils/core/error/payloadTooLarge.ts`
- Modify: `src/core/src/utils/core/error/index.ts`
- Modify: `src/core/src/index.ts`
- Test: `__tests__/core/payload-too-large.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/core/payload-too-large.test.ts`** (create `__tests__/core/` if missing)

```ts
import { describe, expect, it } from "vitest";
import { PayloadTooLargeError } from "@heliosjs/core/utils";

describe("PayloadTooLargeError", () => {
  it("maps to HTTP status 413 and code PAYLOAD_TOO_LARGE", () => {
    const err = new PayloadTooLargeError();
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(413);
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.name).toBe("PayloadTooLargeError");
  });

  it("accepts a custom message", () => {
    expect(new PayloadTooLargeError("too big").message).toBe("too big");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test payload-too-large`
Expected: FAIL — `PayloadTooLargeError` not exported.

- [ ] **Step 3: Add `PAYLOAD_TOO_LARGE` to the `ErrorCode` enum**

In `src/core/src/types/core/error.ts`, add the member immediately before `INTERNAL_SERVER_ERROR`:

```ts
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
```

- [ ] **Step 4: Add the `413` case in `getDefaultStatus`**

In `src/core/src/utils/core/error/base.ts`, add a case after the `NOT_FOUND` case:

```ts
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.PAYLOAD_TOO_LARGE:
        return 413;
```

- [ ] **Step 5: Create `src/core/src/utils/core/error/payloadTooLarge.ts`**

```ts
import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

export class PayloadTooLargeError extends BaseError {
  constructor(message = 'Payload too large', options?: { requestId?: string; path?: string }) {
    super(ErrorCode.PAYLOAD_TOO_LARGE, message, {
      status: 413,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'PayloadTooLargeError';
  }
}
```

- [ ] **Step 6: Export from the error barrel**

In `src/core/src/utils/core/error/index.ts`, add (after `./notfound`, before `./rateLimit`):

```ts
export * from './payloadTooLarge';
```

- [ ] **Step 7: Export from the core index**

In `src/core/src/index.ts`, add `PayloadTooLargeError,` to the named error re-export block (the one listing `NotFoundError`, `RateLimitExceededError`, …), between `NotFoundError` and `RateLimitExceededError`:

```ts
  NotFoundError,
  PayloadTooLargeError,
  RateLimitExceededError,
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `yarn test payload-too-large`
Expected: PASS (2 tests).

- [ ] **Step 9: Verify core builds**

Run: `yarn build:core`
Expected: zero TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/core/src/types/core/error.ts src/core/src/utils/core/error/base.ts src/core/src/utils/core/error/payloadTooLarge.ts src/core/src/utils/core/error/index.ts src/core/src/index.ts __tests__/core/payload-too-large.test.ts
git commit -m "feat(core): add PayloadTooLargeError (413)"
```

---

### Task 2: Body size limit (`collectRawBody`)

**Files:**
- Create: `src/http/src/utils/http/body.ts`
- Modify: `src/http/src/utils/http/server.ts` (remove `collectRawBody`)
- Modify: `src/http/src/utils/http/request.factory.ts`
- Test: `__tests__/http/body-limit.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/http/body-limit.test.ts`** (create `__tests__/http/`)

```ts
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { PayloadTooLargeError } from "@heliosjs/core/utils";
import {
  collectRawBody,
  DEFAULT_BODY_LIMIT,
} from "../../src/http/src/utils/http/body";

function makeReq(headers: Record<string, string> = {}) {
  const req = new EventEmitter() as any;
  req.headers = headers;
  req.destroyed = false;
  req.destroy = () => {
    req.destroyed = true;
  };
  return req;
}

describe("DEFAULT_BODY_LIMIT", () => {
  it("is 1 MB", () => {
    expect(DEFAULT_BODY_LIMIT).toBe(1_048_576);
  });
});

describe("collectRawBody", () => {
  it("resolves the full buffer when under the limit", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 100);
    req.emit("data", Buffer.from("hello"));
    req.emit("end");
    await expect(p).resolves.toEqual(Buffer.from("hello"));
  });

  it("rejects early when content-length exceeds the limit", async () => {
    const req = makeReq({ "content-length": "999" });
    await expect(collectRawBody(req, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(req.destroyed).toBe(true);
  });

  it("rejects mid-stream when actual bytes exceed the limit (no content-length)", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 4);
    req.emit("data", Buffer.from("abcde")); // 5 bytes > 4
    await expect(p).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(req.destroyed).toBe(true);
  });

  it("disables the limit when maxBytes is 0", async () => {
    const req = makeReq({ "content-length": "100000" });
    const p = collectRawBody(req, 0);
    req.emit("data", Buffer.from("x".repeat(5000)));
    req.emit("end");
    await expect(p).resolves.toBeInstanceOf(Buffer);
  });

  it("propagates stream errors", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 100);
    req.emit("error", new Error("socket boom"));
    await expect(p).rejects.toThrow("socket boom");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test body-limit`
Expected: FAIL — `../../src/http/src/utils/http/body` module does not exist.

- [ ] **Step 3: Create `src/http/src/utils/http/body.ts`**

```ts
import http from 'node:http';
import { PayloadTooLargeError } from '@heliosjs/core/utils';

/** Default maximum request body size: 1 MB. */
export const DEFAULT_BODY_LIMIT = 1_048_576;

/**
 * Read the full request body as a Buffer, enforcing a maximum size.
 *
 * @param maxBytes Maximum allowed body size in bytes. Defaults to
 *   DEFAULT_BODY_LIMIT. A value of `0` or `Infinity` disables the limit.
 */
export const collectRawBody = (
  req: http.IncomingMessage,
  maxBytes: number = DEFAULT_BODY_LIMIT,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const limited = maxBytes > 0 && Number.isFinite(maxBytes);
    let done = false;

    const fail = (err: Error) => {
      if (done) return;
      done = true;
      req.destroy();
      reject(err);
    };

    if (limited) {
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        return fail(new PayloadTooLargeError());
      }
    }

    const chunks: Buffer[] = [];
    let received = 0;

    req.on('data', (chunk: Buffer) => {
      if (done) return;
      received += chunk.length;
      if (limited && received > maxBytes) {
        return fail(new PayloadTooLargeError());
      }
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
};
```

- [ ] **Step 4: Remove `collectRawBody` from `src/http/src/utils/http/server.ts`**

Delete the entire `collectRawBody` export block (the `export const collectRawBody = (req: http.IncomingMessage): Promise<Buffer> => { ... };` function) from `server.ts`. If the `import http from 'node:http';` at the top of `server.ts` becomes unused after the removal, delete that import too; if other code in `server.ts` still uses `http`, leave it.

- [ ] **Step 5: Update `src/http/src/utils/http/request.factory.ts`**

Change the import of `collectRawBody` from `./server` to `./body`:
```ts
import { collectRawBody } from './body';
```
Change the `create` signature to accept and forward `maxBytes`:
```ts
  static async create(req: IncomingMessage, maxBytes?: number): Promise<Req> {
```
and the call:
```ts
    const rawBody = await collectRawBody(req, maxBytes);
```
> Note: passing `maxBytes === undefined` lets `collectRawBody` apply its own `DEFAULT_BODY_LIMIT`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn test body-limit`
Expected: PASS (all `collectRawBody` + `DEFAULT_BODY_LIMIT` cases).

- [ ] **Step 7: Verify http builds**

Run: `yarn build:core && yarn build:http`
Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/http/src/utils/http/body.ts src/http/src/utils/http/server.ts src/http/src/utils/http/request.factory.ts __tests__/http/body-limit.test.ts
git commit -m "feat(http): enforce request body size limit (413)"
```

---

### Task 3: Config + Helios wiring (limit pass-through + timeouts)

**Files:**
- Modify: `src/http/src/types/http/http.ts`
- Modify: `src/http/src/Helios.ts`

- [ ] **Step 1: Add config fields in `src/http/src/types/http/http.ts`**

Add these fields inside `ServerConfig` (after the `errorHandler` field):

```ts
  /**
   * Maximum request body size in bytes. Defaults to 1 MB. `0` disables the limit.
   */
  bodyLimit?: number;

  /**
   * Node HTTP server `requestTimeout` in milliseconds. When unset, Node's default applies.
   */
  requestTimeout?: number;

  /**
   * Node HTTP server `headersTimeout` in milliseconds. When unset, Node's default applies.
   */
  headersTimeout?: number;
```

- [ ] **Step 2: Pass the body limit through in `src/http/src/Helios.ts`**

In `requestHandler` (around line 219), change:
```ts
    const request = await RequestFactory.create(req);
```
to:
```ts
    const request = await RequestFactory.create(req, this.config.bodyLimit);
```

- [ ] **Step 3: Set server timeouts in `src/http/src/Helios.ts`**

Immediately after the server is created (around line 81: `this.app = http.createServer(this.requestHandler.bind(this));`), add:
```ts
    if (this.config.requestTimeout !== undefined) {
      this.app.requestTimeout = this.config.requestTimeout;
    }
    if (this.config.headersTimeout !== undefined) {
      this.app.headersTimeout = this.config.headersTimeout;
    }
```

- [ ] **Step 4: Build all affected packages**

Run: `yarn build:core && yarn build:http && yarn build:aws && yarn build:middlewares`
Expected: zero TypeScript errors.

- [ ] **Step 5: Run the full test suite**

Run: `yarn test`
Expected: PASS — all suites including `payload-too-large` and `body-limit`.

- [ ] **Step 6: Commit**

```bash
git add src/http/src/types/http/http.ts src/http/src/Helios.ts
git commit -m "feat(http): configurable bodyLimit and server timeouts"
```

---

## Final Verification

- [ ] **Full test suite**

Run: `yarn test`
Expected: PASS — all suites.

- [ ] **Build all packages**

Run: `yarn build`
Expected: full monorepo build succeeds.

- [ ] **Manual sanity (optional)**

```ts
@Server({ controllers: [App], bodyLimit: 1024 })
class App {}
```
`POST` a >1 KB body → `413 Payload too large`; a small body → handled normally.

## Acceptance Criteria

- Request bodies above the configured limit are rejected with `413` (both from
  `content-length` and mid-stream); the socket is destroyed.
- Default limit is 1 MB; `bodyLimit: 0` disables it.
- `requestTimeout` / `headersTimeout` are applied to the Node server when set.
- `PayloadTooLargeError` exists in core, maps to `413`, and is exported.
- All tests pass; the monorepo builds.
