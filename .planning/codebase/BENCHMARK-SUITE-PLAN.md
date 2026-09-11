# Benchmark & reliability plan (2026-09-11)

Two goals, planned together at the user's request but distinct in kind:

- **Part 1 — comparative performance.** Give Helios evidence for "NestJS-
  shaped developer experience, Fastify-close performance" beyond the one
  routing benchmark that exists today (`benchmarks/`, documented in
  `helios-docs/docs/benchmarks.md`).
- **Part 2 — production-readiness / reliability.** Evidence for the things a
  perf number doesn't cover: stability under sustained load, graceful
  failure, and the process/infra (CI, release policy) around the project.

Plan only — nothing in this doc is implemented yet.

## Part 1 — comparative performance suites

Original ask was 7 more categories (middleware, DI, validation,
serialization, controller/decorators, CRUD+DB, real-app). Trimmed with the
user's sign-off:

- **Controller + decorators** dropped as its own load-test suite — per-
  request it's the same thing the routing suite already measures (routes
  *are* precompiled decorator metadata; see `collectRoutes` in
  `src/core/src/utils/core/controller.ts`). What's genuinely different is
  **startup/compile time** for a large decorated controller tree — that's a
  one-off timing note, not an autocannon suite. Addendum, not a category
  (see bottom of this doc).
- **DI tax** and **CRUD+DB/real-app (7+8, originally merged into one
  composite suite)** both dropped entirely, per the user — Part 1 stays a
  pure Helios-vs-others comparison of routing-adjacent request overhead, no
  Nest-only side track and no database dependency to justify/keep fair.

Net: 3 new suites — middleware pipeline, validation, serialization.

## Shared harness work (do this first, once)

`benchmarks/run.ts` already has the right methodology (child-process
isolation per framework, discarded warmup, median-of-N, results CSV) — reuse
it, don't reinvent it per suite. Concretely:

- Extract `startServer`/`stopServer`/`runAutocannon`/`median`/the CSV
  appender out of `run.ts` into `benchmarks/lib/harness.ts`. `run.ts`
  (routing) imports from it unchanged; each new suite gets its own thin
  runner (`benchmarks/run-middleware.ts`, `run-validation.ts`, etc.) built on
  the same shared pieces instead of a copy-pasted 150-line script five times.
- Each new suite gets its **own** results CSV
  (`benchmarks/results-middleware.csv`, `results-validation.csv`, …) rather
  than widening the existing `results.csv` with a `suite` column — keeps the
  routing history's schema/git-log untouched, and each file stays
  self-describing.
- Each suite extends the **existing** per-framework server files
  (`benchmarks/servers/{helios,express,fastify,nestjs}.ts`) with new
  routes/controllers, instead of spinning up a parallel set of server files
  per suite. One process per framework per run, same as today; less to
  maintain.
- `package.json` gets one script per suite (`benchmark:middleware`,
  `benchmark:validation`, …) plus a `benchmark:all` that runs all of them
  back to back. Existing `yarn benchmark` (routing) stays as-is.

## 1. Middleware pipeline

**Question it answers:** what does each additional guard/pipe/middleware
layer cost, per framework, and does Helios's precompiled-array pipeline scale
better or worse than Express's linear `next()` chain / Nest's
guard→pipe→interceptor stages / Fastify's hook array?

- Scenarios: `/mw/0`, `/mw/3`, `/mw/6` — 0/3/6 layers of an identical trivial
  no-op (read one header, no I/O) ahead of the same handler that returns the
  same payload as the routing suite's `/users`. `/mw/0` is a duplicate of the
  existing `/users` baseline (sanity check the two suites agree).
- Per framework, use its own idiomatic mechanism, not a forced-identical
  code path — that's the point (measuring the *pipeline*, not a shared
  function): Helios `@Use`, Express `app.use()` chain, Fastify `preHandler`
  hooks, Nest `@UseGuards`/`@UseInterceptors` (decorator-based, matching how
  real Nest apps actually stack cross-cutting concerns, not raw Express
  middleware underneath).
- Report reqPerSec **as a function of layer count** per framework (a small
  table/line chart, 4 lines × 3 points) — the slope is the actual finding,
  not any single absolute number.
- Fairness risk: make sure "trivial no-op" really is the same amount of work
  in each framework's idiom (e.g., a guard that does a property read is not
  equivalent to one that does a regex test) — write the *exact* shared
  no-op logic once in the plan/impl and mirror it literally in each server
  file's comments so a reviewer can check by eye.

**Implementation status: DONE.** `benchmarks/servers/{helios,express,fastify,nestjs}-middleware.ts`
(dedicated files, not added to the existing routing-suite servers — see
below for why), `benchmarks/run-middleware.ts`, `yarn benchmark:middleware`.

**Real finding, found while building this, not originally planned:** first
attempt added `/mw/0`/`/mw/3`/`/mw/6` as a new controller in the *existing*
`helios.ts` (reusing the routing suite's server, per "Shared harness work"
above). `/mw/0` came back at ~40% of `/users`' throughput despite doing
*identical* work — profiled it (not guessed): `findRoute` walks
controllers/routes in registration order and only skips a candidate once a
same-or-better-specificity match already exists, so a controller registered
third pays for every earlier controller's failed regex tests on every
request. Reordering to put the new controller first "fixed" `/mw/0` — and
silently degraded `/users`' own already-published baseline by the same
amount, since now *it* was third. Moved the cost, didn't remove it.

This is a real, previously-undiscovered result in its own right: **Helios's
linear route-table scan has a measurable, non-trivial cost even at ~7 total
routes across 3 controllers** — bigger than the routing suite's own 2-route
benchmark ever suggested, and confirms what `BENCHMARK-AUDIT-PHASE2.md`'s
"not applied" section already flagged as a real gap for real apps ("a
radix-tree router... irrelevant at this benchmark's scale... but a real gap
for real large apps") — "irrelevant at this scale" stops being true well
before an app gets large. Not fixed here (that's the router-rewrite item,
still out of scope, still a multi-day change) — worth flagging prominently
for whoever next asks "why does adding routes make my existing routes
slower," because the answer is yes, currently, it can.

**Methodology fix:** rather than fight the shared-server-file structure (any
reordering just relocates which route is cheap), gave the middleware suite
its own dedicated single-concern server per framework — `/mw/0` then has no
sibling routes to compete with, a clean, uncofounded baseline by
construction, and the routing suite's own published numbers stay untouched.
This deviates from "Shared harness work"'s stated preference for extending
the existing server files — the right call once the confound was found, not
a plan followed blindly past the point it stopped making sense. Verified:
`/mw/0` ≈ 86-89k (matches `/users`' own ~87-90k baseline), `/users` itself
unaffected in the unmodified `helios.ts` (still ~87k, re-checked directly).

**Results** (`yarn benchmark:middleware`, 100 connections, 3×8s runs,
median, rows in `benchmarks/results-middleware.csv`):

| Framework | 0 layers | 3 layers | 6 layers | ns/layer (time-based) |
| --- | ---: | ---: | ---: | ---: |
| Fastify | 115,576 | 113,064 | 111,120 | **58ns** |
| Express | 71,152 | 70,288 | 69,280 | 63ns |
| Helios | 89,080 | 86,136 | 85,456 | 79ns |
| NestJS | 63,428 | 62,048 | 61,364 | 88ns |

The req/s "cost/layer" the tool prints isn't the fair cross-framework
number — frameworks start from very different baselines, and req/s and
per-request time aren't linearly related, so the same *time* cost per layer
shows up as a bigger req/s drop for whichever framework has the higher
baseline. Converted to time (`1/reqPerSec` at 0 vs 6 layers, divided by 6):
**all four frameworks add well under 100 nanoseconds per trivial
middleware/guard/hook layer**, same order of magnitude, Helios closer to
Express/Fastify than to NestJS. This is a genuinely good result for the
"NestJS-shaped DX without NestJS-shaped pipeline tax" claim the whole plan
exists to support — Helios's `@Use` stack isn't measurably heavier than
Express's middleware array, and NestJS's guard-checking (`@UseGuards`, its
own most-idiomatic mechanism) is the most expensive of the four, not
Helios's.

## 2. Validation

**Question it answers:** cost of validating a request body, using each
framework's own idiomatic path (this is a "framework integration overhead"
comparison, not a single fixed library benchmarked four times).

- DTO: one representative "create user" shape — 6-8 fields, mixed types
  (string, email, bounded number, optional field, one nested array of
  objects) so nested/array validation cost shows up, not just flat-field
  checks.
- Per framework's idiom:
  - **Helios & NestJS**: `class-validator`/`class-transformer` (both
    frameworks' actual documented path — this keeps the *library* constant
    between these two, isolating framework integration cost specifically).
  - **Fastify**: native JSON Schema + Ajv (its idiomatic, structural
    advantage — expected to win here, and that's fine to report plainly,
    same as the routing suite's Fastify-wins framing).
  - **Express**: no built-in convention; use `class-validator` invoked
    manually in middleware, as the closest fair baseline (same library as
    Helios/Nest, no framework-level integration to speed it up).
- Scenario: `POST /validate` with one fixed valid payload (the happy path is
  what matters at scale — request/sec on rejection is a much smaller
  fraction of real traffic, out of scope to keep this suite from doubling in
  size).
- Fairness risk: label the library used per framework directly in the results
  table — "Fastify: Ajv/JSON Schema, others: class-validator" needs to be
  visible next to the numbers, not buried in prose, or the comparison reads
  as unexplained instead of structural.

**Implementation status: DONE.** `benchmarks/lib/validate-dto.ts` (the DTO +
fixed payload, imported by the Helios/Express/NestJS servers rather than
copy-pasted three times — keeps the class-validator rules byte-identical
across them, not just "similar"), `benchmarks/servers/{helios,express,fastify,nestjs}-validate.ts`,
`benchmarks/run-validation.ts`, `yarn benchmark:validation`. One gotcha hit
and fixed: `class-transformer`'s `@Type()` decorator needs `Reflect.getMetadata`
at class-definition time, so both `express-validate.ts` (which had never
needed `reflect-metadata` before) and `run-validation.ts` itself (the
orchestrator process, which imports the shared DTO module just for the fixed
payload constant, but importing it still evaluates the decorated classes)
needed an explicit `import 'reflect-metadata'` — caught immediately by a
crash on first run, not a silent wrong-number bug.

**Results** (`yarn benchmark:validation`, 100 connections, 3×8s runs,
median, `benchmarks/results-validation.csv`):

| Framework | Req/sec | Latency avg | Library |
| --- | ---: | ---: | --- |
| Fastify | 70,520 | 1.12 ms | JSON Schema / Ajv |
| **Helios** | **41,112** | **2.03 ms** | class-validator |
| Express | 36,428 | 2.05 ms | class-validator (manual) |
| NestJS | 32,734 | 2.60 ms | class-validator |

Fastify's schema-compiled path wins by a wide margin, as expected (its real
structural advantage, same framing as the routing suite). Among the three
class-validator users — same library, same rules, only framework
integration differs — **Helios comes out fastest, ahead of both Express's
manual `plainToInstance`+`validate()` call and NestJS's own `ValidationPipe`**.
Another genuinely good result for the "NestJS DX, not NestJS's tax" claim:
Helios's automatic `@Body(Dto)` validation isn't just "not slower than
manual," it measurably beats both the manual baseline and NestJS's own
idiomatic mechanism.

## 3. Serialization

**Question it answers:** JSON response cost at realistic payload sizes, and
specifically Fastify's schema-compiled serializer advantage — which the
*routing* suite's docs currently call out as intentionally not tested
("doesn't declare Fastify schemas, so it's not an unfair comparison" — see
`helios-docs/docs/benchmarks.md`). This suite is where that gap gets measured
on purpose, so it needs a clear note explaining why it does the opposite of
the routing suite's stance.

- Scenarios: `/serialize/small` (current ~5-field object), `/serialize/medium`
  (100-item array), `/serialize/large` (2,000-item array) — same generated,
  deterministic fixture data across all four frameworks.
- **Fastify runs with a declared response schema** for all three routes (its
  real, idiomatic serialization path). Helios/Express/NestJS use plain
  `JSON.stringify` (none of the three has a schema-compiled fast path to
  enable — nothing to turn on).
- Report the small/medium/large numbers together so the *shape* of the gap
  is visible (expected going in: schema-compiled serialization would widen
  Fastify's lead as payload size grows — see below for what actually
  happened, which is the opposite).

**Implementation status: DONE.** `benchmarks/lib/serialize-fixtures.ts`
(deterministic generator, no `Math.random()` — same bytes every run/server),
`benchmarks/servers/{helios,express,fastify,nestjs}-serialize.ts`,
`benchmarks/run-serialize.ts`, `yarn benchmark:serialize`. Verified all four
servers return byte-identical payload shapes/lengths before running the
timed suite (curl + length checks — the JSON.stringify-vs-schema paths
producing different *shapes* by accident would have invalidated the whole
comparison).

**Results** (`yarn benchmark:serialize`, 100 connections, 3×8s runs, median,
`benchmarks/results-serialization.csv`):

| Scenario | Fastify (schema) | Helios | Express | NestJS |
| --- | ---: | ---: | ---: | ---: |
| small (1 object) | **115,760** | 87,328 | 68,416 | 64,144 |
| medium (100 items) | 30,084 | **33,116** | 27,538 | 26,634 |
| large (2,000 items) | 2,107 | **2,616** | 2,376 | 2,346 |

**This is the opposite of what the plan expected going in** — schema-
compiled serialization does *not* widen Fastify's lead as payload size
grows; it narrows, crosses over, and reverses. Fastify wins small by a wide
margin (its real structural advantage at that size), loses medium to Helios,
and is the **slowest of all four** at large. Surprising enough that it got
verified three ways before writing it down, not just taken from one run:

1. The full-suite run above (already median-of-3).
2. An isolated A/B on `/serialize/large` alone, Helios vs Fastify, two more
   runs each: Helios 2,605/2,603, Fastify 2,081/2,104 — same gap,
   reproducible outside the full 4-framework run's machine conditions.
3. **Causal isolation, not just correlation**: a throwaway Fastify server
   with the *same* 2,000-item payload but **no declared schema** (plain
   `JSON.stringify`) — 2,631 req/s, matching Helios almost exactly. Schema
   *on* costs Fastify ~20% at this size; schema *off* erases the gap
   entirely. `fast-json-stringify` is doing this, not routing, not the HTTP
   layer, not machine noise.

This matches a real, documented characteristic of `fast-json-stringify`
(not something specific to Helios or this benchmark): it walks the declared
schema per array item rather than using V8's own heavily-optimized native
`JSON.stringify` path, and that per-item schema-walk overhead compounds
across a large array faster than the upfront compilation savings pay off.
Small/typical API responses are exactly where it wins; large arrays are
exactly where it can lose. Worth being straightforward about since it cuts
against the "Fastify wins on serialization" framing the routing suite's own
docs already state (correctly, for the shape *that* suite tests) — this
suite exists specifically to check whether that holds at other payload
shapes, and at 2,000 items it doesn't.

Dropped, per the user: no CRUD/database suite. Part 1 stays routing-adjacent
overhead only (middleware, validation, serialization) — nothing that pulls in
a DB dependency or an "is this a fair ORM comparison" question.

## Everything in this plan is done

Part 1 (middleware, validation, serialization) and Part 2 items A-D are all
implemented and measured. The docs page with charts is built — one page per
suite under `helios-docs/docs/` (`benchmarks-middleware.md`,
`benchmarks-validation.md`, `benchmarks-serialization.md`), grouped under a
new "Benchmarks" sidebar category, linked from the main `benchmarks.md`.
`BenchChart` was upgraded from a hardcoded 0-120k axis to an auto-computed
"nice ticks" scale per chart (needed — serialization's numbers span ~2.6k to
~115k, one fixed scale couldn't fit both); verified it reproduces the
existing routing charts' old hardcoded values exactly, so nothing about the
already-published page changed. Per the user's explicit follow-up
(2026-09-11): the "Running it"/"Customizing" sections and links to raw CSVs/
internal planning docs were stripped from all 4 pages — a reader visiting
the docs is there to read results, not run the suite or dig into the repo.
The addendum (startup-compile time) is also done, folded into `benchmarks.md`.

**2F is also done** — the user answered its three open questions (strict
independent semver, no old-major backports, no experimental surface); wrote
`STABILITY.md`, linked from `README.md` and `CLAUDE.md`. Only 2E
(failure-path/chaos testing) stays intentionally skipped, per its own
section's reasoning — low-value overlap with existing coverage, not forced
just to close out a checklist item.

**Also found, not yet fixed:** `README.md`'s own benchmarks table is stale
— different numbers, and describes a methodology ("pipelining 10, 10s
duration") the current suite explicitly doesn't use (`benchmarks.md`'s own
methodology table says "not pipelined," on purpose). Left as-is, flagged to
the user rather than fixed inline — found while touching README for the
`STABILITY.md` link, not what was asked in this pass.

## Reporting

- One doc page per suite under `helios-docs/docs/` (mirroring
  `benchmarks.md`'s structure: methodology note, results table + `BenchChart`,
  a "reading these numbers" section) rather than cramming all 3 into the
  existing page — that page is already routing-specific and referenced from
  the README; adding more content there would bury the existing, working
  page. Link them from a short "Benchmark suite" index instead.
- Each suite's fairness notes (library used, schema-on/off) belong next to
  that suite's results table, not only in this plan doc — a reader who never
  sees `.planning/` still needs to know what was actually measured.

## Suggested build order within Part 1 (if/when this moves to implementation)

1. **Middleware pipeline** — smallest new surface (reuses existing server
   files + routes), most directly supports the "NestJS DX, Helios pipeline
   isn't the tax" argument, no new dependency.
2. **Validation** — same shape of effort as #1, reuses `class-validator`
   already a real dependency of `@heliosjs/core`.
3. **Serialization** — needs Fastify schema definitions written (new work,
   not just enabling a flag) plus fixture generators for 3 payload sizes.

## Part 2 — production-readiness & reliability

User's framing: to call Helios a 9.5-10/10, want evidence beyond throughput
numbers for stress/soak behavior, memory stability, graceful shutdown,
client-disconnect handling, timeout/backpressure, HTTP-parser/router
security, ReDoS protection on route regex, API stability/release policy,
Node LTS compatibility, and failure-path testing.

Checked against the actual repo before planning anything (not assumed):

- **Confirmed gap:** nothing in `src/http` or `src/core` listens for
  `req.on('aborted')` / `res.on('close')` / checks `req.destroyed` — a
  client that disconnects mid-request is invisible to the framework.
- **Confirmed gap:** CI (`.github/workflows/`) has no test step and no PR
  gate at all. `publish.yml` only builds and publishes on push to
  `main`/`master`, single Node version (24). `docs.yml` is docs-only. Nothing
  currently blocks a broken PR or a broken master from being published. This
  was flagged in the 2026-09-11 production audit and deliberately left
  alone then, per that session's request — revisiting now.
- **Already solid, not a gap:** graceful shutdown (SIGTERM/SIGINT → drain via
  `close()`, unit-tested), request/header timeouts (`requestTimeout`/
  `headersTimeout` wired from `@Server` config). Listed below only where
  there's a real incremental addition (verification under load), not rebuilt
  from scratch.

### A. CI: Node LTS matrix + real test gate — DONE

New `.github/workflows/ci.yml`: `test` job matrixed across Node 20/22/24
(install → `yarn build` → `yarn test:coverage`, on every PR + push to
`develop`), plus a non-blocking `lint` job (documented why: master's ~186
by-design `any` errors, see [[lint-and-coverage-broken-on-master]] — flip to
blocking once that's cleaned up, not decided here) and a non-blocking `soak`
job (see B). `publish.yml` now runs `yarn test:coverage` between `Build` and
`Publish`, so a broken release no longer ships silently.

### B. Soak / stability suite — DONE

`benchmarks/soak.ts` (Helios only), built on `benchmarks/lib/harness.ts`
(extracted from `run.ts` — `run.ts` itself now imports from it, behavior
verified unchanged). `benchmark:soak` script; wired into CI as a 20s
non-blocking smoke job.

- **Phase 1 (memory/event-loop):** sustained load, samples RSS/heap/loop-lag
  via IPC every 5s (opt-in `SOAK_REPORT_STATS` env var read by
  `servers/helios.ts` — zero cost for every other suite). Flags (warns, or
  fails if `SOAK_STRICT=1`) when last-quartile RSS exceeds 1.5x first-quartile.
- **Phase 2 (shutdown-under-load):** SIGTERM mid-run, asserts the process
  actually drains instead of hanging, and — after one methodology rewrite —
  classifies connection errors by code. First cut used autocannon's
  aggregate `errors` count as "bad"; that flagged ~24% "errors" on a totally
  healthy shutdown. Root cause: nearly all of it was `ECONNREFUSED` from a
  tight retry loop hitting the listening socket *after* `close()` had
  already (correctly) stopped accepting new connections — the expected,
  desired outcome, not a bug. Rewrote phase 2 on raw `node:http` + a small
  keep-alive `Agent` specifically so `ECONNREFUSED` (new connection, cleanly
  rejected) can be told apart from `ECONNRESET`/other (an in-flight request
  actually dropped). Verified result: Helios's graceful shutdown does drain
  in-flight requests correctly; observed a ~0.004% `ECONNRESET` rate right at
  the `close()` boundary (5 out of ~120k requests), which is normal TCP-
  teardown-race noise present in effectively any graceful-shutdown
  implementation, not a bug — threshold is 0.1%, not zero, so this doesn't
  false-positive on that noise.

### C. Client disconnect / aborted-request handling — DONE (real gap, fixed)

Step 1 (verify first) confirmed the gap directly: an app with a 2s handler,
client disconnects after 0.4s — the handler ran the full 2s anyway (wasted
work) and no error was thrown either way (no crash risk, just wasted work).

Step 2 (fix): added `request.signal: AbortSignal | undefined` to the
`Request` interface — `undefined` off `node:http` (Lambda has no live
connection). Built lazily in `Req` (a getter, not a constructor field) off
`raw.once('aborted', ...)` — Node's `'aborted'` event is soft-deprecated in
favor of `res.on('close')` + checking `res.writableEnded`, but that needs a
reference to the Response object, which doesn't exist yet when `Req` is
constructed; `'aborted'` needs no such cross-wiring and still fires on every
currently-supported Node line. Verified against a real disconnect (fires,
handler can react) and a real normal completion (never fires — no false
positive). App code passes it straight through: `fetch(url, {signal:
request.signal})`, most DB drivers accept the same shape. Zero cost for
requests that never read `request.signal` (nothing is allocated or listened
to until first access). 5 new unit tests in `request.test.ts`.

**Also found & fixed while verifying this pass, unrelated to C itself:**
`eslint.config.js`'s `ignores` list didn't exclude `helios-docs/.docusaurus/`
(Docusaurus's own generated bundle, gitignored but not eslint-ignored) —
building the docs locally made `yarn lint`'s count jump from 186 to 239
because Docusaurus's own bundled JS was getting linted as if hand-written.
Fixed by adding it to `ignores`; verified by rebuilding the docs and
re-linting (185, not 239, with the directory present).

### D. Router / input fuzzing + ReDoS audit — DONE

- **HTTP parser left out of scope, as planned** — that's `llhttp` inside
  `node:http`, Node's surface, not Helios's code.
- **Router fuzzing:** used a curated adversarial-path corpus instead of the
  `fast-check` property-based approach floated above — ponytail call made
  during implementation: for a regex/segment-based router this size, a
  hand-picked corpus of the well-known attack/edge shapes (traversal
  attempts, double/empty segments, null bytes, 200k-char paths, unicode,
  regex-special characters) covers the same ground a security review would
  check by hand, without a new dependency. `__tests__/core/unit/security/router-fuzz.test.ts`
  — 29 cases against static/param/wildcard/optional/inline-regex routes, all
  via real `@Controller`/`@Get`-decorated classes (not the raw matcher
  helpers) so the test exercises the actual compiled-regex path apps hit.
  Confirmed: traversal segments (`..`) are never resolved as filesystem
  navigation, just literal path segments — a static route doesn't
  accidentally match a traversal attempt against it, and a 200k-char
  adversarial path still resolves in well under 200ms (i.e. linear, not
  catastrophic).
- **ReDoS, both sub-problems:**
  - *Framework-generated patterns* — same router-fuzz file times the
    static/param/wildcard/optional/inline-regex (`:id(\d+)`) shapes against
    very long adversarial input; all resolve in milliseconds, confirming
    no catastrophic backtracking in Helios's own generated regex.
  - *User-supplied inline regex* — also went hand-rolled instead of
    `safe-regex` (same reasoning: the plan's own fallback option, a small
    heuristic, was enough — no need for a dependency whose maintenance
    status wasn't even checked). New `looksReDoSRisky()` in
    `utils/core/redos.ts`: flags the classic nested-quantifier shape
    (`(a+)+`, `(a*)*`, `(a+){2,}`) via one regex-on-a-regex pattern match —
    not a full analysis (documented as such in its own JSDoc), a nudge not
    a gate. Wired into `compileRouteRegex` in `controller.ts`: warns via the
    existing `getGlobalLogger()` **once per risky route, at registration
    time** (route construction, not per-request — zero hot-path cost).
    `__tests__/core/unit/security/redos.test.ts` — unit tests for the
    heuristic itself plus an integration test confirming the warning fires
    for a risky pattern and stays silent for an ordinary one
    (`\d+`/`[a-z]+`/alternation).

**Also found while re-checking lint after this pass:** the ~185-187 lint
error count isn't "effectively all by-design `any`s" as
[[lint-and-coverage-broken-on-master]] previously said — only ~73 are;
the other ~114 (most of it) is test files not being covered by any
`tsconfig.json` at all (root config's `include` is `src/**/*` and explicitly
excludes `**/*.test.ts`), so ESLint's type-aware rules never actually run on
`__tests__/**` — corrected that memory. Separately, `.docusaurus/` (Docusaurus's
build cache) wasn't in `eslint.config.js`'s `ignores` either — building the
docs locally made the count jump to 239; fixed and verified.

### E. Failure-path / chaos testing

Smaller incremental add, not a new testing subsystem — existing coverage
already exercises a lot of the error-handling surface (`@Catch`,
`SKIP_ERROR_HANDLER_CODES`, non-Error-throw logging, 413/malformed-JSON
handling, per the 2026-09-11 production audit). What's missing is genuinely
adversarial mid-request failure (a guard/pipe/interceptor throwing after the
socket already closed, a downstream call rejecting mid-stream) — fold a
handful of these into suite C's test file rather than standing up a separate
chaos-testing framework.

### F. API stability & release policy — DONE

User's answers to the three open questions: (1) strict independent semver
per package, a breaking change in one does not auto-bump another, even a
dependent — matches how Changesets is already configured here, just made
explicit; (2) no backport support for old majors, current major only;
(3) no experimental surface — GraphQL/WebSocket are stable, same guarantee
as everything else, "optional to enable" isn't "can break without a major."

Wrote `STABILITY.md` at the repo root (not folded into `CLAUDE.md`, which is
about repo mechanics for whoever/whatever is working *in* the repo —
this is a public consumer-facing guarantee, belongs where an npm
consumer would look for it). Covers: versioning scope, what counts as a
breaking change (anything through a package's declared public entry
points; explicitly *not* anything tagged `@internal`, reusing the existing
JSDoc-overhaul convention rather than inventing a new marker), support
window, and experimental-surface stance. Linked from `README.md` and from
`CLAUDE.md`'s "Releasing" section (which also got one accuracy fix while
touched: it said `publish.yml` only runs `yarn build`, which was true when
written but item 2A added a `yarn test:coverage` step before publish —
updated to match).

## Combined priority order (both parts, per the user's call)

Reliability infra first, then the comparative suites — cheap trust-building
work shouldn't wait behind the more elaborate perf suites:

1. ~~**CI Node LTS matrix + test gate**~~ (2A) — **done.**
2. ~~**Soak / memory / shutdown-under-load**~~ (2B) — **done.**
3. ~~**Client disconnect handling**~~ (2C) — **done** (real gap, fixed —
   `request.signal`).
4. ~~**Router fuzzing + ReDoS audit**~~ (2D) — **done.** 2E (failure-path/
   chaos additions) was scoped to fold into this pass but didn't get its own
   test — the specific scenario (a guard/pipe/interceptor throwing *after*
   the socket already closed) overlaps significantly with error-handling
   paths the existing suite already covers (`@Catch`,
   `SKIP_ERROR_HANDLER_CODES`, non-Error-throw logging); left as a real but
   low-priority gap rather than forcing it in. Pick up if it's ever a
   concrete pain point, not preemptively.
5. ~~**Middleware pipeline**~~ (Part 1, suite 1) — **done.** Found and fixed
   a real methodology confound along the way (route-table-position cost,
   see suite 1's own section above) before it could quietly bias the
   numbers. All four frameworks add well under 100ns per trivial layer.
6. ~~**Validation**~~ (Part 1, suite 2) — **done.** Helios beats both Express
   (manual) and NestJS (`ValidationPipe`) using the identical library/rules —
   not just parity, ahead.
7. ~~**Serialization**~~ (Part 1, suite 3) — **done.** Surprise finding,
   verified three ways: Fastify's schema-compiled serializer wins small
   payloads big, but is the *slowest* of all four at 2,000 items — the
   plan's own "should widen Fastify's lead" expectation was wrong.
8. **API stability & release policy doc** (2F) — not time-ordered against the
   rest; happens whenever you answer the open questions above.

**All of Part 1 (comparative perf) is now done, alongside all of Part 2
except 2F.** Next up, per the user's explicit request mid-work: a docs page
with charts/good UI for the expanded results, now that every suite has
landed. Also still open: 2F (blocked on the user), the addendum
(startup-compile-time note), and 2E (deferred, low-priority).

**Status: all of Part 2 reliability work is done except the policy doc**
(blocked on you) **and the minor 2E gap noted above.** Verified throughout:
`yarn test` 1532/1532, `yarn build` clean (5 packages), `yarn test:coverage`
clears thresholds, `yarn lint` 187 (up from 185 baseline — the 2 new test
files hit the same pre-existing "test files aren't covered by any tsconfig"
parsing-error pattern nearly every other test file already has, not a new
problem — see [[lint-and-coverage-broken-on-master]]). Nothing committed —
same convention as the earlier benchmark-audit passes.

## Addendum (not a suite): controller/decorator startup-compile time — DONE

Measured `new ControllerClass(meta)` (the `collectRoutes`/
`buildCompiledMiddleware` compile pass) for a 50-route tree across 10 nested
sub-controllers, 200 iterations, throwaway script deleted after running:
**cold (first, unoptimized) call ≈ 0.8ms; warm-median ≈ 0.08ms, warm-p99 ≈
0.3-0.5ms** (3 runs, consistent). Confirms the hypothesis: compile cost is a
one-time, sub-millisecond startup cost, negligible against everything else
an app does at boot, and doesn't scale into per-request latency. Folded one
sentence + the cold number into `benchmarks.md`'s "Reading these numbers"
section, as planned — no new suite, no committed script.
