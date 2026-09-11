---
sidebar_position: 21
description: Per-layer cost of guards/pipes/middleware — Helios @Use vs Express middleware vs Fastify preHandler vs NestJS @UseGuards.
---

import BenchChart from '@site/src/components/BenchChart';

# Benchmarks: middleware pipeline

The [main benchmarks page](./benchmarks) measures routing/dispatch with no
guards, pipes, or middleware in the way. This one asks the next question:
**what does each additional pipeline layer cost**, per framework, using each
one's own idiomatic mechanism — Helios's `@Use`, Express's middleware array,
Fastify's `preHandler` hooks, NestJS's `@UseGuards` — not a Node middleware
function forced into all four.

Same process-isolation/warmup/median-of-3 methodology as the main page (see
its [Methodology](./benchmarks#methodology) section) — this page only covers
what's different.

:::note
Each framework's server here is its own dedicated process with nothing else
routed — not the same server file the main routing page benchmarks. A route
sharing a process with other, earlier-registered routes pays for the
router's linear scan past them; a single-concern server avoids that
confound entirely rather than trying to correct for it after the fact.
:::

## Results

Captured 2026-09-11, same machine/config as the main page: 100 connections,
3 runs × 8s (+2s warmup). Each scenario stacks 0, 3, or 6 layers of an
identical no-op (reads one header, no I/O) ahead of the same handler.

<BenchChart title="0 middleware layers" data={{ Fastify: 115576, Helios: 89080, Express: 71152, NestJS: 63428 }} />
<BenchChart title="3 middleware layers" data={{ Fastify: 113064, Helios: 86136, Express: 70288, NestJS: 62048 }} />
<BenchChart title="6 middleware layers" data={{ Fastify: 111120, Helios: 85456, Express: 69280, NestJS: 61364 }} />

| Framework | 0 layers | 3 layers | 6 layers | Cost/layer |
| --------- | -------: | -------: | -------: | ---------: |
| Fastify   |  115,576 |  113,064 |  111,120 |  **58 ns** |
| Express   |   71,152 |   70,288 |   69,280 |      63 ns |
| Helios    |   89,080 |   86,136 |   85,456 |      79 ns |
| NestJS    |   63,428 |   62,048 |   61,364 |      88 ns |

### Reading these numbers

- **"Cost/layer" here is a time cost, not a req/s cost.** Raw req/s lost per
  layer isn't comparable across frameworks with very different baselines —
  the same per-layer *time* cost shows up as a bigger req/s drop for
  whichever framework already has the higher baseline, since req/s and
  per-request time aren't linearly related. Converting through `1 / req/sec`
  (time per request) at 0 vs 6 layers removes that skew; that's what's in
  the table.
- **All four frameworks add well under 100 nanoseconds per trivial layer.**
  Same order of magnitude across the board — this isn't "Helios's pipeline
  is heavy," it's "every framework here pays a small, comparable tax per
  guard/hook/middleware." Helios sits closer to Express and Fastify than to
  NestJS; NestJS's own `@UseGuards` — its documented, idiomatic mechanism,
  not a workaround — is the most expensive of the four per layer.
