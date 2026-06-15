# DoS Hardening — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

Harden the HeliosJS HTTP server against two denial-of-service vectors:

1. **Unbounded request bodies** — `collectRawBody` currently buffers an entire
   request body with no size limit, so one large or chunked request can exhaust
   process memory. Add a configurable body size limit that rejects oversized
   requests with `413 Payload Too Large`, enforced both from the `content-length`
   header and during streaming.
2. **Slow / stalled connections** — expose the Node HTTP server's
   `requestTimeout` and `headersTimeout` as configuration (slow-loris defense).

A new `PayloadTooLargeError` (`413`) is added to the core error system.

## Goals

- Configurable maximum request body size with a safe default (1 MB).
- Reject oversized requests early (declared `content-length`) and mid-stream
  (actual bytes), defending against absent or dishonest `content-length`.
- Configurable `requestTimeout` / `headersTimeout` on the HTTP server.
- A proper `413` error surfaced through the existing error pipeline.

## Non-Goals

- No body limit for the AWS Lambda adapter — Lambda request payloads are already
  capped by API Gateway/ALB, and `collectRawBody` is HTTP-only.
- No rate limiting (separate concern, separate work).
- No change to gRPC.

## Background

- `collectRawBody(req)` (`http/src/utils/http/server.ts`) resolves a `Buffer`
  from `req.on('data')` with no limit and no timeout. It is called once, from
  `RequestFactory.create(req)` (`http/src/utils/http/request.factory.ts:30`).
- The request handler `Helios.requestHandler(req, res)`
  (`http/src/Helios.ts:216`) calls `RequestFactory.create(req)`. The Node server
  is created at `Helios.ts:81` (`http.createServer(this.requestHandler.bind(this))`).
- `ServerConfig` (`http/src/types/http/http.ts`) holds server options.
- The error system: `BaseError(code, message, { status, requestId, path })`
  accepts an explicit `status`. `RateLimitExceededError`
  (`core/src/utils/core/error/rateLimit.ts`) is the template — it passes
  `status: 429`. `BaseError.getDefaultStatus(code)` (`error/base.ts`) maps
  `ErrorCode` → HTTP status as a fallback. Error classes are exported via
  `core/src/utils/core/error/index.ts` and re-exported from `core/src/index.ts`.

## Architecture

### 1. `PayloadTooLargeError` (core)

Add `PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE'` to the `ErrorCode` enum
(`core/src/types/core/error.ts`). Add a `413` case to
`BaseError.getDefaultStatus` (`error/base.ts`). New class mirroring
`RateLimitExceededError`:

```ts
// core/src/utils/core/error/payloadTooLarge.ts
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

Export from `error/index.ts` and add `PayloadTooLargeError` to the named error
re-export block in `core/src/index.ts`.

### 2. Body size limit (http)

Move body reading into a dedicated, single-responsibility file
`http/src/utils/http/body.ts` (today it lives in `server.ts` alongside
`resolveConfig`; splitting keeps the limit logic isolated and testable without
dragging in unrelated imports). Remove `collectRawBody` from `server.ts`.

```ts
// http/src/utils/http/body.ts
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

`RequestFactory.create` gains an optional `maxBytes` parameter and forwards it:

```ts
// request.factory.ts
static async create(req: IncomingMessage, maxBytes?: number): Promise<Req> {
  // ...
  const rawBody = await collectRawBody(req, maxBytes);
  // ...
}
```
(Import `collectRawBody` from `./body` instead of `./server`.)

`Helios.requestHandler` passes the configured limit:

```ts
// Helios.ts:219
const request = await RequestFactory.create(req, this.config.bodyLimit);
```

When `this.config.bodyLimit` is `undefined`, `collectRawBody` applies
`DEFAULT_BODY_LIMIT` (1 MB). Setting `bodyLimit: 0` disables the limit.

### 3. Server timeouts (http)

Immediately after the server is created in the `Helios` constructor
(`Helios.ts:81`):

```ts
this.app = http.createServer(this.requestHandler.bind(this));
if (this.config.requestTimeout !== undefined) {
  this.app.requestTimeout = this.config.requestTimeout;
}
if (this.config.headersTimeout !== undefined) {
  this.app.headersTimeout = this.config.headersTimeout;
}
```

When unset, Node's defaults (`requestTimeout` 300s, `headersTimeout` 60s) remain.

### 4. Config surface (`ServerConfig`)

```ts
export interface ServerConfig {
  // ...existing...
  /** Maximum request body size in bytes. Default 1 MB. `0` disables the limit. */
  bodyLimit?: number;
  /** Node server requestTimeout in ms. When unset, Node's default applies. */
  requestTimeout?: number;
  /** Node server headersTimeout in ms. When unset, Node's default applies. */
  headersTimeout?: number;
}
```

Usage:
```ts
@Server({
  bodyLimit: 1_048_576,   // 1 MB (default); 0 disables
  requestTimeout: 30_000, // ms (optional)
  headersTimeout: 15_000, // ms (optional)
})
class App {}
```

## Data Flow

```
http.createServer → requestHandler(req, res)
  → RequestFactory.create(req, config.bodyLimit)
    → collectRawBody(req, maxBytes)
       • content-length > maxBytes      → destroy + PayloadTooLargeError (413)
       • streamed bytes > maxBytes      → destroy + PayloadTooLargeError (413)
       • otherwise                      → Buffer
  → PayloadTooLargeError flows through the existing error handler → 413 response
```

## File-Change Summary

| Package | File                                              | Change                                                   |
| ------- | ------------------------------------------------- | -------------------------------------------------------- |
| core    | `src/types/core/error.ts`                         | add `PAYLOAD_TOO_LARGE` to `ErrorCode`                   |
| core    | `src/utils/core/error/base.ts`                    | add `413` case in `getDefaultStatus`                     |
| core    | `src/utils/core/error/payloadTooLarge.ts` (new)   | `PayloadTooLargeError`                                   |
| core    | `src/utils/core/error/index.ts`, `src/index.ts`   | export `PayloadTooLargeError`                            |
| http    | `src/utils/http/body.ts` (new)                    | `collectRawBody` + `DEFAULT_BODY_LIMIT` (with limit)     |
| http    | `src/utils/http/server.ts`                        | remove `collectRawBody`                                  |
| http    | `src/utils/http/request.factory.ts`               | `create(req, maxBytes?)`, import from `./body`           |
| http    | `src/Helios.ts`                                   | pass `config.bodyLimit`; set request/headers timeouts    |
| http    | `src/types/http/http.ts`                          | `bodyLimit`, `requestTimeout`, `headersTimeout`          |
| __tests__ | `__tests__/core/payload-too-large.test.ts` (new)| `PayloadTooLargeError` → 413                             |
| __tests__ | `__tests__/http/body-limit.test.ts` (new)       | `collectRawBody` limit behavior                          |

## Testing

- `PayloadTooLargeError`: maps to HTTP status `413` and code `PAYLOAD_TOO_LARGE`.
- `collectRawBody`:
  - resolves the full buffer when the body is under the limit;
  - rejects with `PayloadTooLargeError` when `content-length` exceeds the limit
    (early reject, before reading the stream);
  - rejects with `PayloadTooLargeError` when actual streamed bytes exceed the
    limit even though `content-length` is absent/understated;
  - `maxBytes: 0` and `maxBytes: Infinity` disable the limit (large body passes);
  - default limit (no `maxBytes`) is `DEFAULT_BODY_LIMIT` (1 MB).

Tests run from the root Vitest runner. The http body test imports
`collectRawBody` from the source file directly; it depends only on
`@heliosjs/core/utils` (aliased to core source), so no new alias is required. A
fake `IncomingMessage` is an `EventEmitter` exposing `headers`, `destroy()`, and
emitting `data`/`end`/`error`.

## Open Questions

None. All design decisions resolved during brainstorming.
