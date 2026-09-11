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

Captured 2026-09-11 on Darwin 25.6.0, Node v24.14.0, Apple M4 (10 cores),
after a hot-path perf pass on Helios (see below). Config: 100 connections,
3 runs × 8s per scenario (+2s discarded warmup), no pipelining.

**`GET /users` (static route)**

<BenchChart
  title="GET /users (static route)"
  data={{ Fastify: 113560, Helios: 89184, Express: 70936, NestJS: 64156 }}
/>

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 113,560 | 0.05 ms      | 1.00 ms      | 22.31 MB/s |
| Helios    |  89,184 | 0.94 ms      | 2.00 ms      | 18.03 MB/s |
| Express   |  70,936 | 1.02 ms      | 2.00 ms      | 16.71 MB/s |
| NestJS    |  64,156 | 1.02 ms      | 2.00 ms      | 16.52 MB/s |

**`GET /users/:id` (param route)**

<BenchChart
  title="GET /users/:id (param route)"
  data={{ Fastify: 111080, Helios: 83678, Express: 69264, NestJS: 59376 }}
/>

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 111,080 | 0.05 ms      | 1.00 ms      | 22.35 MB/s |
| Helios    |  83,678 | 1.01 ms      | 2.00 ms      | 17.32 MB/s |
| Express   |  69,264 | 1.02 ms      | 2.00 ms      | 16.65 MB/s |
| NestJS    |  59,376 | 1.06 ms      | 3.00 ms      | 15.57 MB/s |

### Reading these numbers

- **Fastify still wins by a wide margin** on both routes. It compiles routes
  into a radix tree and (when schemas are declared) serializes responses with
  a compiled fast-path — neither of which the other three frameworks do here.
  This suite doesn't declare Fastify schemas, so this is Fastify's
  routing/dispatch floor, not its ceiling.
- **Helios beats both Express and NestJS**, and closed part of the Fastify
  gap in this update (roughly 25% → 20%) by removing per-request overhead
  that didn't scale with route complexity: dead-end async hops in the
  pipeline for routes with no guards/pipes/middleware, a duplicate
  `Content-Type` header write, and a `crypto.randomUUID()` call for the
  request-correlation id. None of that was routing cost — routing itself was
  already cheap (see below) — it was fixed overhead paid on every request
  regardless of route shape.
- The param route still costs Helios relatively little over the static one
  (83,678 vs 89,184 req/s, ~6%) despite doing real extra work — a regex
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

