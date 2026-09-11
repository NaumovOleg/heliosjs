# Benchmark audit — phase 2 (2026-09-11)

Follow-up to `BENCHMARK-AUDIT.md` (phase 1: dedup routing regex, reuse
precompiled rate-limit list, zero-middleware fast path — applied, +4-6%).
Phase 1 ended with an explicit next step:

> Collapsing `execute()`'s own per-request async-chain overhead for the
> zero-guard/pipe/interceptor case — scoped as its own follow-up, needs its
> own before/after pass.

This is that pass.

## Current baseline (results.csv, commit 61b4c76)

| Route | Helios | Fastify | Gap |
| --- | ---: | ---: | ---: |
| `GET /users` | ~85,300 req/s | ~113,700 req/s | -25% |
| `GET /users/:id` | ~84,400 req/s | ~106,700 req/s | -21% |

Latency avg for Helios sits at ~1ms flat regardless of route shape; Fastify's
is ~0.05-0.1ms. That flatness is the same tell phase 1 already named: fixed
per-request pipeline cost, not routing work. With phase 1's routing/rate-limit
fixes already in, what's left in that fixed cost is almost entirely
**microtask overhead** — `await`s that exist structurally even when there is
nothing to wait for.

## Traced: where the ticks go (plain `GET /users`, no guards/pipes/cors/rate-limit)

`descriptors/request.ts` → `execute()` → …

1. `await beforeRequest(request, response, route)` — `beforeRequest` is
   `async`; calling it costs a tick even though its own body does nothing for
   this route (all four loops iterate zero times).
2. Inside `beforeRequest`: `await enforceRateLimit(...)` — same shape,
   `enforceRateLimit` is `async` and returns immediately (`items.length === 0`)
   but the `await` still costs a tick.
3. Back in `execute()`: `await Promise.resolve(route.fn(...args))` — the
   benchmark handler returns a plain object synchronously, but
   `Promise.resolve(value)` + `await` always costs a tick to unwrap, even for
   an already-resolved value.

That's 3 microtask hops that do zero real work on the hottest path in the
whole framework. Fastify's router calls the handler directly when no hooks
are registered — no promise chain to traverse at all. This is *the* gap; it
is not routing (2 routes, linear scan is irrelevant at this scale), not CORS
(`[].reduce()` on an empty array is a no-op), not rate-limiting (already
short-circuits).

Checked against Fastify's own source for anything structural being missed:
it doesn't special-case `setNoDelay`/Nagle either (phase 1 already ruled
that out), doesn't build a full WHATWG `URL` per request (parses off
`req.url` directly), and generates request IDs from an incrementing counter,
not `crypto.randomUUID()`. Noted below, not applied.

## Applied this pass

**1. Skip `beforeRequest()` entirely when the route has no guards, pipes,
sanitizers, middlewares, or rate limits.** These are the only things
`beforeRequest` (`utils/core/controller.ts`) ever does; when all five are
empty it's a guaranteed no-op. Added `hasBeforeRequestWork: boolean` to
`CompiledMiddleware`, computed once in `buildCompiledMiddleware` (construction
time, not per-request). `execute()` only calls/awaits `beforeRequest` when
it's `true`; otherwise `handled` is `false` with no async hop. Routes that
*do* have any of the five are byte-for-byte unchanged.
— `types/core/controller.ts`, `utils/core/controller.ts`

**2. Don't `await` a handler result that isn't a promise.** `route.fn(...args)`
is called the same as before (so a synchronous throw is still caught by the
same `try`); its result is only `await`-ed when it looks like a thenable
(`typeof result?.then === 'function'`), matching what `Promise.resolve(x)`
would do anyway for both native promises and generic thenables. Async
handlers are unaffected (still awaited, same semantics); sync handlers (the
benchmark's case, and probably most CRUD-shaped routes with no I/O in the
handler itself) skip a tick.
— `utils/core/controller.ts` (`execute`)

**3. Lazily allocate `Req`'s per-request state `Map`.** `_state` backs
`setState`/`getState`, used by almost nothing in a typical request, but was
constructed unconditionally in the constructor. Now created on first
`setState` call; `getState`/`getAllState` treat "never touched" as empty.
Zero-risk, contained to `Req`.
— `utils/core/request.ts`

## Considered, not applied

- **`crypto.randomUUID()` for `requestId` → incrementing counter.** Real (if
  Fastify does it), but `requestId` is a public field apps may log/assert on
  as a UUID; swapping formats is a behavior change with no way to know who
  depends on the shape, for a save that's small next to items 1-2 above
  (`randomUUID()` is a native binding, not a JS loop). Skip unless someone
  profiles it as an actual line item.
- **Avoiding `new URL()` in `RequestFactory.create` / lazy `request.requestUrl`.**
  Traced it: `query` is currently derived *from* `requestUrl.searchParams`, so
  "skip building the URL" would also mean re-deriving query parsing off a raw
  substring instead — doable, but `requestUrl` is a public typed field
  (`Request.requestUrl: URL`) read in error serialization and GraphQL routing,
  and making it lazy only matters for requests that never touch it. Given the
  3 promise ticks above are the measured dominant cost (structural, on every
  request, regardless of route), this is a smaller, riskier-for-the-size
  change. Deferred, not dismissed — worth a follow-up if items 1-2 don't close
  enough of the gap on their own.
- **Radix-tree router (find-my-way-style) to replace the linear
  specificity-ranked scan.** Correct fix for apps with hundreds of routes;
  irrelevant at this benchmark's scale (2 routes) and a genuinely large diff
  (new matching semantics, wildcard/optional-segment edge cases to preserve).
  Not this pass — flag for whoever hits it with a route table large enough to
  matter.
- **Schema-based response serialization (`fast-json-stringify`-equivalent).**
  Same call as phase 1: no schema system exists to hang it off, not an
  apples-to-apples gap, skip.

## Why this isn't the "big refactor" it might look like

The request came in expecting this to need a large rewrite. It doesn't: the
entire fix is three narrow, mechanical changes to one function
(`execute`/`beforeRequest` in `controller.ts`) plus one lazy field in `Req` —
no router rewrite, no new dependency, no pipeline restructuring, no public API
change. The pipeline *shape* (CORS → rate limit → sanitize → guard → pipe →
middleware → params → handler → interceptors → errors) is untouched; only the
cost of walking it when a stage is empty changes.

## The tick-counting reasoning undersold it — profiled instead of guessing more

First A/B (items 1-2 only) measured +1.4-1.5%, well under what "remove 3
structural `await`s" suggested. Rather than keep reasoning about tick counts
in the abstract, profiled the actual autocannon load: `node --prof` on the
benchmark server + `--prof-process` on the resulting log.

Top-level split: **77% C++, 18% JS, 1% GC.** Most of the C++ time is socket
I/O / TCP (the profiler's own symbolication gets unreliable for C++ frames on
this platform — several entries are almost certainly nearest-symbol
misattributions of libuv/kernel work, not literal calls to those functions)
— that's baseline HTTP-server cost every framework here pays, Fastify
included, not something to chase. Inside the addressable 18% JS slice, two
things stood out that reading the code hadn't caught:

- **`checkInvalidHeaderChar`/`checkIsHttpToken`-style regexes** (Node's
  internal header validation, run inside `ServerResponse.setHeader()`) at a
  combined ~1.6% of total ticks. Traced it to a real duplicate: `Res`'s
  constructor already defaults `Content-Type` to `application/json`, and
  `Helios.sendResponse` was calling `setHeader('Content-Type', ...)` *again*
  with the identical value for every non-string response body — a second,
  wasted trip through Node's native header validation on every request.
- **`crypto.randomUUID()`** (`getBufferedUUID` in the profile) at ~0.8% of
  total ticks, for a `requestId` that exists for log correlation, nothing
  security-sensitive.

`new URL()`/`parseQuery`/`URLSearchParams` combined came in under 0.3% of
total ticks — confirms the phase-1-style reasoning that deferred touching
`requestUrl` was the right call; it just wasn't where the JS-side cost
actually was.

## Applied (revised) — 4 changes total

**1 & 2. `beforeRequest()` skip + non-thenable handler result** — as designed
above, unchanged.

**3. Lazy `Req._state` Map** — as designed above, unchanged.

**4. Stop double-setting `Content-Type`.** `Helios.sendResponse` now reads
the current header once and only calls `setHeader` when the value is
actually changing (still sets `text/plain` for string bodies exactly as
before — only the redundant same-value write is skipped).
— `src/http/src/Helios.ts`

**5. Fast per-request `requestId`.** Added `generateFastRequestId()`
alongside the existing `generateUniqueId()` in `utils/shared/helpers.ts`: one
random base36 tag generated once per process, plus a monotonic counter —
`${tag}-${counter++}`, no crypto call on the request path. Scoped narrowly:
only `RequestFactory.create`'s `requestId` (the profiled hot path) switched
to it; `generateUniqueId()` (real `crypto.randomUUID()`) is untouched and
still used for WebSocket/SSE client ids, which aren't in the per-request hot
path and where the previous unpredictable-UUID shape is lower-risk to keep.
Decided with the user rather than unilaterally — this changes a public
field's format (no longer a UUID), which is exactly the kind of
externally-visible behavior change that's better confirmed than assumed;
counter-based was the explicit choice made.
— `src/core/src/utils/shared/helpers.ts`, `src/http/src/utils/http/request.factory.ts`

## Verification — done

- `yarn test`: 1495/1495 passing (106 files), unchanged, re-checked after
  every batch of edits including the final restored state.
- `yarn build`: clean across all 5 packages.
- `yarn lint`: same 186 pre-existing errors as master (by-design `any`s on
  decorator signatures, see [[lint-and-coverage-broken-on-master]]) — none in
  any of the 6 touched files, re-checked after the final edit too.
- `yarn test:coverage`: thresholds still clear (statements 95.73/95, branches
  88.18/88, functions 96.07/96, lines 96.23/96) — thin against branches same
  as before, not made worse.
- A/B on Helios only, this machine, git stash/rebuild between states, 100
  connections, 5×4s runs per route, median. Final round, all 5 fixes in
  (interleaved after → after → before, same session so machine state is
  comparable):

  | Route | Before | After (2 runs) | Δ |
  | --- | ---: | ---: | ---: |
  | `GET /users` | 86,144 | 90,672 / 90,880 | **+5.4%** |
  | `GET /users/:id` | 83,536 | 89,504 / 89,216 | **+7.0%** |

  Bigger than the items-1-3-only round (+1.4-1.5%) — the header/request-id
  fixes found by profiling mattered more in practice than the microtask-count
  reasoning predicted for items 1-3 alone. Latency avg/p99 still don't move
  outside autocannon's ~1ms histogram bucket (same finding as phase 1 and the
  first phase-2 round) — the resolution just isn't fine enough to see it
  there; the throughput numbers are the reliable signal.

**Honest framing:** +5-7% throughput, from 5 contained changes (no new
dependency, no router rewrite, no pipeline restructuring). Real and
reproducible (2 confirmation runs both directions), but the Fastify gap
(~113k vs ~90k req/s now, ~20%) is still there — 77% of CPU time under this
load is in C++ (socket I/O, the HTTP parser), which every framework here pays
equally, so there isn't a lot of *addressable* JS-level cost left to chase on
this exact benchmark shape (2 static/param routes, no auth/body/validation).
Further gains would need one of the items already filed under "considered,
not applied" above (radix router at real route-table scale, schema-based
serialization) — both genuinely bigger changes with their own risk surface,
not more of this pass's shape. Not attempted here; flagged for whoever picks
it up with a concrete reason to (a large route table, or schema support
landing for other reasons).

## Canonical record

Ran the full 4-framework `yarn benchmark` once these changes were in (rows
appended to `benchmarks/results.csv`, commit label `a55401e` since these
changes aren't committed yet — the script labels by HEAD regardless of a
dirty tree):

| Framework | `GET /users` | `GET /users/:id` |
| --- | ---: | ---: |
| Fastify | 113,560 | 111,080 |
| **Helios** | **89,184** | **83,678** |
| Express | 70,936 | 69,264 |
| NestJS | 64,156 | 59,376 |

`/users` matches the isolated A/B (+5% over the ~85,300 baseline). `/users/:id`
reads closer to flat here (83,678 vs ~84,400 baseline) — the 4-framework run
only takes 3 sub-runs per framework vs the isolated A/B's 5, and frameworks
share the machine across the whole ~3.5-minute run, so it's noisier for a
same-machine delta than the isolated A/B above. Trust the isolated A/B
(+5.4%/+7.0%) for "did this change help"; trust this table for "how does
Helios compare to the others right now."
