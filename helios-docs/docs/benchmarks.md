---
sidebar_position: 20
description: How HeliosJS's throughput benchmark works, and current Helios vs Express vs Fastify vs NestJS results.
---

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

Captured 2026-09-11 on Darwin 25.6.0, Node v24.14.0, Apple M4 (10 cores).
Config: 100 connections, 3 runs × 8s per scenario (+2s discarded warmup),
no pipelining.

**`GET /users` (static route)**

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 118,120 | 0.03 ms      | 1.00 ms      | 23.21 MB/s |
| Helios    |  82,264 | 1.01 ms      | 2.00 ms      | 16.63 MB/s |
| Express   |  71,376 | 1.02 ms      | 2.00 ms      | 16.81 MB/s |
| NestJS    |  64,512 | 1.02 ms      | 2.00 ms      | 16.61 MB/s |

**`GET /users/:id` (param route)**

| Framework | Req/sec | Latency avg | Latency p99 | Throughput |
| --------- | ------: | -----------: | -----------: | ---------: |
| Fastify   | 116,560 | 0.03 ms      | 1.00 ms      | 23.45 MB/s |
| Helios    |  79,664 | 1.01 ms      | 2.00 ms      | 16.48 MB/s |
| Express   |  69,384 | 1.02 ms      | 2.00 ms      | 16.67 MB/s |
| NestJS    |  60,816 | 1.05 ms      | 2.00 ms      | 15.95 MB/s |

### Reading these numbers

- **Fastify wins by a wide margin** on both routes. It compiles routes into
  a radix tree and (when schemas are declared) serializes responses with a
  compiled fast-path — neither of which the other three frameworks do here.
  This suite doesn't declare Fastify schemas, so this is Fastify's
  routing/dispatch floor, not its ceiling.
- **Helios beats both Express and NestJS**, and the param route barely
  costs it anything relative to the static route (~3% slower). That tracks
  with the architecture: `@Controller` precompiles every route into a regex
  and a dedicated param extractor at construction time (see
  `collectRoutes` in `src/core/src/utils/core/controller.ts`), so per-request
  routing is a regex match plus a lookup, not a fresh parse.
- **NestJS is the slowest**, including behind plain Express, on both routes.
  This is expected, not a bug in the test: Nest's default adapter *is*
  Express, plus its own dependency-injection and module-resolution layer on
  top of it. You're paying Express's routing cost either way and adding
  Nest's on top — this benchmark isolates exactly that delta.

## Running It

From the repository root:

```bash
yarn benchmark
```

This runs `benchmark:build` (compiles `benchmarks/` with `tsc`) and then
`benchmarks/dist/run.js`, which for each framework:

1. Forks it as its own child process on its own port.
2. Runs a discarded 2s warmup, then 3 measured runs per scenario.
3. Kills that process before moving to the next framework.
4. Prints a median-of-3 results table per scenario.

Override the defaults with environment variables:

```bash
BENCH_DURATION=15 BENCH_CONNECTIONS=200 BENCH_RUNS=5 yarn benchmark
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `BENCH_DURATION` | `8` | Seconds per measured run |
| `BENCH_CONNECTIONS` | `100` | Concurrent connections |
| `BENCH_RUNS` | `3` | Measured runs per scenario (reported as median) |

## Customizing

- Each framework's server lives in its own file under `benchmarks/servers/`
  (`helios.ts`, `express.ts`, `fastify.ts`, `nestjs.ts`). It reads its port
  from `process.env.PORT`, starts listening, and calls `process.send('ready')`.
- To add a framework, add a new `benchmarks/servers/<name>.ts` following that
  pattern and add `{ name, file }` to the `FRAMEWORKS` array in
  `benchmarks/run.ts`.
- To add a scenario, add `{ name, path }` to the `SCENARIOS` array — it runs
  against every framework automatically.
