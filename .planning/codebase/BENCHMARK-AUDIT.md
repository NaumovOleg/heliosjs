# Benchmark audit — 2026-09-11

Scope: why Helios trails Fastify in `yarn benchmark` (see
`helios-docs/docs/benchmarks.md`), what's fixable without a rewrite, and what
was actually applied this pass. Read the whole hot path
(`Helios.requestHandler` → `beforeRequest` → `CONTROLLER_REQUEST` →
`matchRoutes`/`execute`) before touching anything — this doc only covers the
plain-JSON-route path the benchmark exercises (no auth/cors/validation).

## Baseline (from the docs, captured on this machine)

| Framework | GET /users req/s | GET /users/:id req/s | latency avg |
| --- | ---: | ---: | ---: |
| Fastify | 118,120 | 116,560 | 0.03 ms |
| Helios  |  82,264 |  79,664 | 1.01 ms |
| Express |  71,376 |  69,384 | 1.02 ms |
| NestJS  |  64,512 |  60,816 | 1.02 ms |

Helios already beats Express/NestJS. The gap that matters is Fastify, ~30-40%
on throughput. Latency avg for Helios/Express/NestJS is ~1ms flat regardless
of route shape — that flatness is the tell: the cost is fixed per-request
pipeline overhead, not routing/regex work. (Ruled out Nagle/TCP_NODELAY as the
latency explanation: grepped Fastify's own source, it doesn't call
`setNoDelay` either, so that's not the differentiator — likely just autocannon's
latency histogram losing precision under ~1ms, not a real 30x gap.)

## Applied this pass (see diff — src/core + src/http, no new deps, no API break)

1. **Routing matched the route twice per request.**
   `descriptors/request.ts` called `matchRoutes`, which internally calls
   `matchCompiledRegex` (regex exec + builds the params object) on the winning
   candidate — then discarded that params object. `execute()` immediately
   called `extractRouteParams`, which ran the exact same regex against the
   exact same path again to rebuild it. Fixed by adding `findRoute` (returns
   `{ route, params }`, same search) and threading the params through to
   `execute` as an optional 4th arg. `matchRoutes` itself is untouched (now a
   thin wrapper) — all its tests keep passing unchanged, and other `execute()`
   callers (tests, anything that doesn't have a prior match) still derive
   params the old way.
   — `src/core/src/utils/core/match.ts`, `controller.ts`, `descriptors/request.ts`

2. **Rate limiting was already precompiled and then recomputed anyway.**
   `buildCompiledMiddleware` fills `compiled.rateLimits` for every route at
   construction time, but nothing ever read it — `enforceRateLimit` did its
   own `route.functions.map().filter()` on every single request instead,
   which is real work (two array allocations) for a value that was already
   sitting on `route.compiled`. Fixed by passing `compiled.rateLimits`
   through; `enforceRateLimit` still falls back to scanning `route.functions`
   when called without it (direct calls, all the existing unit tests).
   — `src/core/src/utils/core/controller.ts`, `ratelimit/enforce.ts`

3. **The middleware pipeline allocated and awaited through itself even when
   completely unconfigured.** `Helios.beforeRequest` always builds
   `runMiddlewares`/`afterStatic`/`afterConfig` closures and chains through
   ~6 async hops (static → config → global → plugin `beforeRoute` → route),
   even when `staticMiddlewares`, `middlewares`, and `globalMiddlewares` are
   all empty — which is the benchmark's case, and probably most apps that
   don't register global middleware. Added a fast path: when all three are
   empty, skip straight to `restOfPipeline()`. Existing (non-empty) behavior
   is byte-for-byte unchanged since the guard only fires when there is
   nothing to run.
   — `src/http/src/Helios.ts`

### Measured effect

Not the full 4-framework suite (minutes per run) — a same-machine A/B on
Helios only, `git stash`/rebuild before vs after, 100 connections, 5×4s runs,
median, both benchmark routes:

| Route | Before | After | Δ |
| --- | ---: | ---: | ---: |
| `GET /users` | 82,976 req/s | 86,192 req/s | +3.9% |
| `GET /users/:id` | 80,048 req/s | 84,480 req/s | +5.5% |

Consistent in the same direction on both routes across two separate runs —
real, not noise, but modest. Latency avg didn't move outside measurement
resolution (~1ms bucket). All 1495 tests, lint, and `yarn build` are green
with these changes; coverage still clears the configured thresholds.

**Honest framing:** this closes maybe a sixth of the Fastify gap. It's a
correct, low-risk cleanup (dead recompute removed, redundant regex removed,
zero-config fast path added) — worth keeping regardless — but it is not "beat
Fastify." That needs the harder item below.

## Not applied — bigger lever, needs a real change window

**Fastify special-cases the zero-hook path structurally** (its router calls
the handler directly when no hooks are registered, no promise chain at all).
Helios's pipeline is async-chain-shaped even at its fastest, and item 3 above
only papers over the top layer of that — `execute()`'s own CORS-reduce,
`beforeRequest()`'s sanitizer/guard/pipe/middleware loops (all `for...of`
over compiled arrays, cheap but still function-call+await per stage), and the
`Promise.resolve(route.fn(...))` wrapping all cost a fixed amount per request
regardless of route. Collapsing that further (e.g., a compiled fast path for
"route has zero guards/pipes/interceptors/cors" that calls `route.fn` almost
directly) would move the needle a lot more than items 1-3, but it touches the
one function every route in the codebase runs through (`execute` in
`controller.ts`) and needs the same before/after discipline: full test run +
coverage + a real A/B, not just "looks faster." Scope it as its own change,
don't bolt it onto a cleanup pass.

**Response serialization**: `Res.end()` does `JSON.stringify(data)` on every
plain-object response — same as every other framework here (Fastify's
advantage is `fast-json-stringify` from a declared schema, which this suite
doesn't configure for any framework, so it's not an unfair comparison). Not
worth chasing without schema support already existing — skip.

## Benchmark harness itself — stability, not speed

The audit request also asked about *stabilizing* the benchmark, separate
from the app's speed:

- **3 runs is thin for a median.** The existing A/B here needed 5 to see a
  consistent signal above noise; `benchmarks/run.ts`'s default `BENCH_RUNS=3`
  is enough to reject wild outliers but not enough to trust a <5% delta
  between two runs of the suite. If someone wants to detect regressions this
  small, bump the default or report IQR/stdev alongside the median so a
  reader can tell "moved" from "noisy."
- **No repo-tracked history.** Numbers live in one markdown table that gets
  overwritten each time someone updates it. A regression 3 releases back is
  invisible. Low-effort fix: append `{date, commit, framework, scenario,
  reqPerSec}` rows to a checked-in CSV/JSON in the same PR that updates the
  table, so `git log` on that file becomes the trend line. Skip anything
  fancier (a dashboard, a CI perf gate) until someone's actually been bitten
  by a silent regression — YAGNI until then.
- **Machine noise dominates single-run deltas.** Nothing to fix in-repo; just
  don't trust a benchmark run against a diff smaller than ~5% without
  multiple runs, same as the A/B methodology used above.

## What was deliberately not touched

- No new dependency, no radix-tree router rewrite, no schema-based response
  fast-path — all of those are real ways to close more of the Fastify gap,
  but they're multi-day changes with their own risk surface, not a
  stabilize-and-improve pass. Flagged above for whoever picks this up next.
- Didn't touch `benchmarks/run.ts`'s `BENCH_RUNS` default or add a
  history file — that's a process change for whoever owns the benchmark
  numbers to decide on, not something to slip into a code-fix PR.
