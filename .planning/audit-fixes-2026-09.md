# Audit fixes — plan & progress

Started 2026-09-10. Source: deep audit of `src/*/src` (no tests/docs).
Gates: `yarn test` (baseline 1479 pass / 6 expected-fail), `yarn build`.
Working branch: `develop`. Do NOT commit unless asked.

Rule: after each item run `yarn test`; after each package group `yarn build`.
Update the checkbox + one-line note here as each item lands.
`[ ]` todo  `[~]` in progress  `[x]` done

---

## BUGS

### B1.1 — `res.stream()` doesn't stream (returns `"{}"`)
- `src/core/src/utils/core/response.ts` `end()`: pipe readables, pass Buffers/primitives through, only `JSON.stringify` plain objects.
- Also fix `headersSent` getter (`?? ` → `|| `) so a started pipe reports sent (prevents `Helios.sendResponse` double-`end`).
- [x] done — end() rewritten; headersSent getter fixed.

### B1.2 — `res.buffer()` corrupts binary
- Core `end()` path: covered by B1.1.
- AWS: `src/aws/src/lambda.ts` `toLambdaResponse` — base64-encode Buffer `response.data`, set `isBase64Encoded: true`.
- [x] done — `encodeBody()` helper in lambda.ts (Buffer→base64+flag, string respects isBase64Encoded, object→JSON).

### B1.3 — Lambda HTTP API drops response cookies, echoes request cookies
- `src/aws/src/lambda.ts:140-142` — use `response.cookies` not `request.cookies`.
- `src/core/.../response.ts` `setCookie` — on lambda `raw` is `Req`; don't clobber `request.cookies`.
- [x] done — toLambdaResponse uses `response.cookies`; rest→multiValueHeaders Set-Cookie, http/url→cookies[]. `Res.setCookie` no longer mirrors onto raw.

### B1.4 — regex/optional route params unreadable by name
- Kept `matchRoutes` signature (40+ test call sites). Instead: `execute` now extracts params via `match.ts`'s regex/segment logic (`extractRouteParams` → `matchCompiledRegex`), same code as the matcher. Deleted `buildParamExtractor` + `Route.compiledParamExtractor`.
- Also fixed `compileRouteRegex`: trailing `*` now captures (`(?:/(.*))?`), mid-route `*` stays non-capturing; `matchCompiledRegex` group-indexing updated to match.
- `getParams` kept (public + directly tested) but no longer on the request path.
- [x] done — it.fails B1 flipped → passes. 1480 pass / 5 xfail.

### B1.5 — multi-value query lost on API GW v1 / ALB
- `src/aws/src/utils/aws/lambda.event.normalizers.ts:77,146` — merge single + multiValue query maps.
- [x] done — `getMergedQueryParameters()` in utils/aws/lambda.ts; v1 + ALB normalizers use it. Repeated key → array, else scalar.

### B1.6 — CORS header lookups case-sensitive
- `src/core/src/utils/core/cors.ts:44,50` + `headers.ts:getOrigin` — use `req.getHeader(...)`.
- [x] done — added `getHeaderCI(headers, name)` in headers.ts; cors.ts + getOrigin use it. Test helper `makeRequest.getHeader` also made properly case-insensitive.

### B1.7 — `@Headers(name)` case-sensitive
- [x] done — `execute` resolves header-by-name via `getHeaderCI`. it.fails B13 flipped.

### B1.8 — `@Headers(Dto)` / `@Cookies(Dto)` not validated
- [x] done — `Headers`/`Cookies`/`Files` decorators now take `(nameOrDto?, nameOrOptions?, options?)` → DTO reaches `param.dto`. Both it.fails B14 flipped. (1483 pass / 2 xfail: B3, B12.)

### B1.9 — JSON body parse failure swallowed
- `parseBody` now throws `BaseError(BAD_REQUEST, 'Invalid JSON body', {status:400})` on bad JSON (empty body still → undefined).
- Guarded `RequestFactory.create` in `Helios.requestHandler` + aws `createHandler` (was unguarded — a throw there, incl. `PayloadTooLargeError`, was an unhandled rejection). Both now emit a minimal `{code,status,message}` JSON error.
- New e2e: `__tests__/http/e2e/body-parsing.e2e.test.ts`. Updated 2 unit tests that asserted the swallow.
- NOTE / follow-up (not in original list): `collectRawBody` calls `req.destroy()` on overflow → client sees ECONNRESET, not a 413. Left as-is (unit tests pin the destroy; graceful 413 needs drain + `Connection: close`).
- [x] done

### B1.10 — multipart field JSON.parse type coercion
- [x] done — `multipart.ts` only `JSON.parse` when text starts `{`/`[`; scalars stay strings. Updated 2 tests that asserted the coercion.

### B1.11 — HEAD not served by matching GET route
- [x] done — `matchRoutes` second pass falls back HEAD→GET on a miss (explicit `@Head` still wins). `Helios.sendResponse` sends no body for HEAD. it.fails B3 flipped.

### B1.12 — route-array middlewares run in reverse
- [x] done — dropped `.reverse()` in `collectRoutes`. it.fails B12 flipped. **All 1488 tests pass, 0 expected-fail.**

### B1.13 — malformed `%` in static URL → 500
- [x] done — `decodeURIComponent` wrapped; malformed → `next()`.

### B1.14 — MemoryStore unbounded
- [x] done — `maxEntries` ctor arg (default 10_000), re-insert on write, evict oldest on overflow. ponytail comment. +2 eviction tests.

### B1.15 / B1.16 — X-Forwarded-For trusted unconditionally
- [x] done — `Req.trustProxy` (from `RequestOptions`); `getClientIp`/`isSecure` read `X-Forwarded-*` only when set. http `RequestFactory` → socket IP + `ServerConfig.trustProxy` (default false); aws → `LambdaOptions.trustProxy` (default true). 5 unit tests updated + "ignored by default" tests added.

### B1.17 — `reset()` leaves `_isRedirect`
- [x] done — `reset()` clears `_isRedirect`.

### B1.18 — Lambda `Res` gets `Req` as `raw` (json()/end() noisy no-op)
- `response.ts` `end()` — silent no-op when no raw sink; drop `console.error` for lambda/unknown.
- [x] done — `end()` returns quietly when `raw.end` isn't a function.

---

## OPTIMISATION

### O2.1 — params computed twice per request → folded into B1.4
- [x] done — matcher's regex result is now the single source; `execute` reuses `matchCompiledRegex`. (Still one `.exec` in matcher + one in `execute`; a full "return params from matchRoutes" would need the test-churn we avoided. Acceptable — no per-segment re-parsing.)

### O2.2 — `execute` param loop O(n²)
- [x] done — dense `byIndex` array built once in `execute` (`route.parameters` is tiny, so no Route-type churn for a compile-time cache).

### O2.3 — `Math.max(singleExpr)` no-op
- [x] done — removed; `totalParams` computed in the same loop as `byIndex`.

### O2.4 — `Req.getHeader` linear scan + alloc
- [x] done — fast path `lower in this.headers` (Node lower-cases keys), fallback `for..in` scan; no `Object.entries` alloc. (Full lowercase-index skipped — pipes reassign `request.headers`, index would go stale; not worth a getter/setter for ~15-entry maps.)

### O2.5 — multipart parsed even when unused
- [x] done — `getBodyAndMultipart` only runs when a param is `body`/`multipart`.

### O2.6 — dead "uncompiled" parallel path
- [x] done — `execute` + `beforeRequest` derive `compiled` via `buildCompiledMiddleware` fallback; removed the ~60-line uncompiled branch + duplicate interceptor/errorHandler loops; catch reuses `runErrorHandlers`. Side effect: hand-built test routes now get phase-ordered pipeline (matches production) — fixed 1 test that pinned the old interleaved quirk. Raw non-Error throws still swallowed when no `@Catch` (pinned by a test, out of scope).

### O2.7 — `ApplicationError` built twice per `response.error()`
- [x] done — `execute` returns right after `response.error(data)` on the error path instead of falling through to `response.data = data` (which re-wrapped + re-logged).

### O2.8 — repeated `string.split('/')` in matching
- [x] done — `route.compiledSegments` precomputed in `collectRoutes`; `matchCompiledRegex` uses it.

---

## CLEANLINESS

### C3.1 — dead prototype-redefine loop — `Controller.ts:92-99`
- [x] done — deleted.

### C3.2 — middleware validation checks wrong list — `Controller.ts:63`
- [x] done — validates `controllerMiddlewares` (the real list).

### C3.3 — duplicate error-handler loops — reuse `runErrorHandlers`
- [x] done — folded into O2.6.

### C3.4 — `helper.ts:75` identical ternary branches
- [x] done — that whole function (`buildParamExtractor`) was deleted in B1.4.

### C3.5 — two MIME maps
- [x] done — new `utils/shared/mime.ts` (`MIME_TYPES` + `mimeFromPath`/`mimeFromExtension`); `multipart.ts` (~100-line inline map removed) and `http/static.ts` (`MIME_MAP` removed) both consume it.

### C3.6 — overlapping error classification/formatting
- [~] SKIPPED — `serializeError`/`isError`/`getErrorType` are published `@heliosjs/core/utils` exports with a full 250-line test suite; deleting them / changing `getErrorType`'s shape is a breaking change + heavy test rewrite for a cosmetic win. They're isolated pure functions, no bug risk. Left as-is.

### C3.7 — dead helpers
- [~] PARTIAL — `extractMiddlewares` simplified (C3.8). `buildRoutePattern`/`mergeMiddlewares`/`mergeInterceptors`/`isClass`/`pathStartsWithPrefix` left: published `export *` API, each 1-3 lines, each with dedicated tests. Removing published exports = major-bump risk not worth it.

### C3.8 — `extractMiddlewares` dead `?? []`
- [x] done — `fns.map(f => f[type]).filter(Boolean)`.

### C3.9 — Content-Type / X-Response-Time in multiple places
- [x] done — `X-Response-Time` now set only in `Res.end()`; removed from `Helios.sendResponse` (and its unused `startTime` param/local). CT re-derivation left in one place (`sendResponse`) as intended.

### C3.10 — `console.*` → `Logger`
- [x] done — `Endpoint.ts`, `response.ts` (B1.18), `http/static.ts`, `socket/server.ts`, `sse/server.ts`, `socket/socket.ts`, `http/plugin.ts`, `aws/plugin.ts`, `aws/lambda.event.normalizers.ts` → `getGlobalLogger()`. (`logger.ts` itself and JSDoc `@example` blocks keep `console`.)

### C3.11 — cruft
- [x] done — removed `STOPPED` banner (`constants.ts`), the commented `Any` block (`Endpoint.ts`), translated the RU comment in `aws/utils/aws/lambda.ts`.

### C3.12 — `Req.clone()` inconsistencies
- [x] done — carries `rawBody` / `isBase64Encoded` / `trustProxy` / `url` / `requestUrl` from overrides-or-self instead of hardcoding.

---

## FINAL
- [x] `yarn test` green — **1492 pass / 0 fail / 0 expected-fail** (was 1479 pass / 6 xfail). +1 new e2e file (`body-parsing`), +eviction tests.
- [x] `yarn build` clean (all 5 packages).
- [ ] tell user; do NOT commit unless asked.

## Deliberately not done (noted above)
- C3.6 (error-helper dedup) and most of C3.7 (dead 1-liner helpers) — published API + test churn, no bug/behaviour benefit.
- `collectRawBody` graceful 413 (discovered during B1.9) — `req.destroy()` on overflow drops the connection instead of sending 413; unit tests pin the destroy.
- "raw non-Error `throw`" with no `@Catch` is still swallowed in `execute` (pre-existing, pinned by a test).
