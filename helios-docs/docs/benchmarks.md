---
sidebar_position: 20
description: How HeliosJS's throughput benchmark works, and current Helios vs Express vs Fastify vs NestJS results.
---

import BenchChart from '@site/src/components/BenchChart';

# Benchmarks

The repository ships a benchmark suite (`benchmarks/`) that runs the same
small API — `GET /users`, `GET /users/:id`, `POST /users`, `GET /health` — on
Helios, [Express](https://expressjs.com/), [Fastify](https://fastify.dev/),
and [NestJS](https://nestjs.com/) (default `@nestjs/platform-express`
adapter), then load-tests each with
[autocannon](https://github.com/mcollina/autocannon).

:::note
Throughput numbers are highly dependent on the machine, Node version, and
what else is running at the time. The table below was captured on one
machine on one day — run the benchmark yourself before relying on it for a
real decision.
:::

This page covers plain routing/dispatch — no guards, validation, or
middleware in the way. Three more pages measure those specifically:

- **[Middleware pipeline](./benchmarks-middleware)** — per-layer cost of
  guards/pipes/middleware, each framework's own idiom.
- **[Validation](./benchmarks-validation)** — request-body validation cost,
  `class-validator` vs Fastify's native JSON Schema.
- **[Serialization](./benchmarks-serialization)** — JSON response cost at
  1/100/2,000-item payloads, including a result that runs against the
  routing page's own Fastify-wins framing.

## Methodology

Naive same-process, single-sample benchmarks are noisy and easy to game by
accident (JIT warmup, GC pauses, and event-loop contention from one
framework leak into the next one's numbers). This suite fixes the usual
suspects:

| Concern | What this suite does |
| --- | --- |
| Cross-framework interference | Each framework runs in its own child process, one at a time — never sharing an event loop or process with another framework under test. |
| JIT/connection warmup | A 2s warmup run against each server is discarded before any measured run. |
| Single-sample noise | Each scenario is measured 3 times per framework; the reported number is the **median**, not the first or best run. |
| Unrealistic pipelining | Requests are **not pipelined**. HTTP/1.1 pipelining is rarely used by real clients and inflates req/s far past what production traffic sees, so it's left off (autocannon's default). |
| One endpoint hiding routing cost | Two scenarios are measured separately: a static route (`GET /users`) and a param route (`GET /users/:id`), since param extraction/regex matching is where routing implementations tend to diverge. |

All four servers implement identical routes with no database, validation,
or middleware — the benchmark measures raw routing/dispatch overhead, not a
realistic application. Treat the result as a relative comparison between
frameworks on one machine, not an absolute number to plan capacity around.

## Results

Captured 2026-09-22 on Darwin 25.6.0, Node v24.14.0, Apple M4 (10 cores),
`@heliosjs/core` @ commit `fa462de` (the current trie-based router — see
[Routing at scale](#routing-at-scale-route-table-size) below; a 2-route app
is too small for the trie to change anything measurably, so these numbers
are steady across both the pre- and post-trie code). Config: 100
connections, 3 runs × 8s per scenario (+2s discarded warmup), no
pipelining. Full history in `benchmarks/results.csv`.

**`GET /users` (static route)**

<BenchChart
  title="GET /users (static route)"
  data={{ Fastify: 122888, Helios: 89808, Express: 72672, NestJS: 65810 }}
/>

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 122,888 | 0.05 ms      | 1.00 ms      | 24.14 MB/s |
| Helios    |  89,808 | 0.98 ms      | 2.00 ms      | 18.16 MB/s |
| Express   |  72,672 | 1.02 ms      | 2.00 ms      | 17.12 MB/s |
| NestJS    |  65,810 | 1.03 ms      | 2.00 ms      | 16.95 MB/s |

**`GET /users/:id` (param route)**

<BenchChart
  title="GET /users/:id (param route)"
  data={{ Fastify: 120216, Helios: 87280, Express: 71008, NestJS: 62756 }}
/>

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 120,216 | 0.05 ms      | 1.00 ms      | 24.20 MB/s |
| Helios    |  87,280 | 1.00 ms      | 2.00 ms      | 18.06 MB/s |
| Express   |  71,008 | 1.02 ms      | 2.00 ms      | 17.07 MB/s |
| NestJS    |  62,756 | 1.05 ms      | 3.00 ms      | 16.46 MB/s |

### Reading these numbers

- **Fastify wins by a wide margin** on both routes — roughly a quarter ahead
  of Helios (27% static, 27% param, this run). It compiles routes into a
  radix tree and (when schemas are declared) serializes responses with a
  compiled fast-path — neither of which the other three frameworks do here.
  This suite doesn't declare Fastify schemas, so this is Fastify's
  routing/dispatch floor, not its ceiling. The gap moves a few points
  between runs (an earlier capture on 2026-09-11 measured ~21-25%, same
  methodology, same machine) — read it as "consistently around a quarter,"
  not a precise figure to the decimal.
- **Helios beats both Express and NestJS** on both routes, by a wider and
  more stable margin than the Fastify gap. A past optimization pass removed
  per-request overhead that didn't scale with route complexity — dead-end
  async hops in the pipeline for routes with no guards/pipes/middleware, a
  duplicate `Content-Type` header write, and a `crypto.randomUUID()` call
  for the request-correlation id — none of which was routing cost (routing
  itself was already cheap, see below); it was fixed overhead paid on every
  request regardless of route shape.
- The param route still costs Helios relatively little over the static one
  (87,280 vs 89,808 req/s, ~2.8%) despite doing real extra work — a regex
  capture group plus a lookup instead of a static string compare. That
  tracks with the architecture: `@Controller` precompiles every route into a
  regex and a dedicated param extractor at construction time (see
  `collectRoutes` in `src/core/src/utils/core/controller.ts`), so per-request
  routing is a regex match plus a lookup, not a fresh parse. That
  construction-time compile pass itself is cheap and one-time, not something
  that scales into request latency: building a 50-route tree across 10
  nested sub-controllers takes well under 1ms even on a cold (unoptimized,
  first-call) run — negligible against everything else an app does at boot.
- **NestJS is the slowest**, including behind plain Express, on both routes.
  This is expected, not a bug in the test: Nest's default adapter *is*
  Express, plus its own dependency-injection and module-resolution layer on
  top of it. You're paying Express's routing cost either way and adding
  Nest's on top — this benchmark isolates exactly that delta.

## Routing at scale (route-table size)

The results above use a 2-route app, which is realistic for this micro-benchmark
but too small to show whether a route's *position* in the table costs anything.
A separate suite (`yarn benchmark:routes`, `benchmarks/run-routes.ts`) answers
that with a 300-route table (10 controllers × 30 routes: 25 static, 4 param, 1
trailing wildcard each), measuring the first-declared route, a middle one, the
last-declared static route, the last-declared param route, and a 404 — all on
the same table, so any spread is purely a function of position, not payload.

:::note
Same caveats as above (one machine, one day: Darwin 25.6.0, Node v24.14.0,
Apple M4). Captured 2026-09-22. Full numbers, including latency, in
`benchmarks/results-routes.csv`.
:::

**`@heliosjs/core` ≤ 4.0.6 — linear scan.** `findRoute` walked every
method-matching route in the whole controller/children tree, in declaration
order, on every request:

| URL position     | Req/sec | % of first-declared |
| ----------------- | ------: | -------------------: |
| first-declared     |  72,640 |               100.0% |
| middle             |  53,912 |                74.2% |
| last-declared (static) | 45,000 |            61.9% |
| last-declared (param)  | 43,116 |            59.4% |
| 404 (no match)     |  30,792 |                42.4% |

**`@heliosjs/core` ≥ 4.0.7 — trie index.** Routes whose segments are all
static, plain `:name`, or (last segment only) trailing `?`/`*` are indexed in
a per-segment trie, built lazily on first lookup and cached per controller-tree
root — lookup cost depends on path depth, not table size:

| URL position     | Req/sec | % of first-declared |
| ----------------- | ------: | -------------------: |
| first-declared     |  89,752 |               100.0% |
| middle             |  89,392 |                99.6% |
| last-declared (static) | 90,288 |           100.6% |
| last-declared (param)  | 87,712 |            97.7% |
| 404 (no match)     |  43,744 |                48.7% |

Fastify (radix tree, not re-measured per version since its router didn't
change) stays flat across all five positions on the same table, ~118k–125k
req/s either way — that flat shape is the target the trie index reaches.

**Reading these numbers:**

- The trie removes route-position as a cost entirely for static/param routes:
  61.9% → 100.6% of the first-declared route's throughput at the
  last-declared one. The flat baseline is also ~24% faster than the old
  scan's *first*-route case (72,640 → 89,752) — a cached trie lookup beats
  re-walking even route #1 from scratch every request.
- **The 404 numbers sit well below the flat plateau on both versions** (42.4%
  / 48.7%) — that's the cost of constructing and serializing a
  `NotFoundError` response (stack trace, timestamp, request id), not routing.
  Fastify's default 404 is far cheaper to produce, which is most of why its
  own 404-vs-first-declared ratio (96–99%) looks so much flatter than
  Helios's here; it isn't a routing-speed gap.
- Routes that can't be indexed exactly — a `:name(regex)` segment (its regex
  isn't anchored to one path segment), a mid-route `*`/`?`, or a hand-built
  route with no precompiled regex — stay on the old linear path in both
  versions. Real route tables have few of these, so this doesn't show up at
  the scale measured here.

