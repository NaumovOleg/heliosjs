---
sidebar_position: 23
description: JSON serialization cost at 1/100/2,000-item payloads — including where Fastify's schema-compiled serializer stops winning.
---

import BenchChart from '@site/src/components/BenchChart';

# Benchmarks: serialization

The [main benchmarks page](./benchmarks) deliberately doesn't declare
Fastify response schemas — "this is Fastify's routing/dispatch floor, not
its ceiling," as that page puts it. This page is where that ceiling gets
measured on purpose: Fastify runs **with** a declared response schema here
(compiled to [`fast-json-stringify`](https://github.com/fastify/fast-json-stringify),
its real idiomatic serialization path); Helios, Express, and NestJS use
plain `JSON.stringify`, since none of the three has an equivalent
schema-compiled fast path to enable. Same process-isolation/warmup/
median-of-3 methodology as the [main page](./benchmarks#methodology), each
framework on its own dedicated server.

Three payload sizes, same generated fixture data (deterministic, no
randomness) across all four frameworks:

| Scenario | Shape |
| -------- | ----- |
| small  | one object, 5 fields |
| medium | 100-item array of that object |
| large  | 2,000-item array of that object |

## Results

Captured 2026-09-11, same machine/config as the main page.

**small (1 object)**

<BenchChart title="small (1 object)" data={{ Fastify: 115760, Helios: 87328, Express: 68416, NestJS: 64144 }} />

**medium (100-item array)**

<BenchChart title="medium (100-item array)" data={{ Helios: 33116, Fastify: 30084, Express: 27538, NestJS: 26634 }} />

**large (2,000-item array)**

<BenchChart title="large (2,000-item array)" data={{ Helios: 2616, Express: 2376, NestJS: 2346, Fastify: 2107 }} />

| Scenario | Fastify (schema) | Helios | Express | NestJS |
| -------- | ---------------: | -----: | ------: | -----: |
| small    | **115,760**      | 87,328 | 68,416  | 64,144 |
| medium   | 30,084           | **33,116** | 27,538 | 26,634 |
| large    | 2,107            | **2,616**  | 2,376  | 2,346  |

### Reading these numbers

**This is not what walking in you'd expect from "schema-compiled
serialization."** Going into this suite, the assumption was that Fastify's
lead would *widen* as payloads grow — more data, more to gain from
compiling the schema once instead of walking a generic object at runtime.
The opposite happened: Fastify's lead narrows from small to medium, and by
large it's not a lead at all — **Fastify is the slowest of the four
frameworks** on a 2,000-item array.

That was surprising enough to verify three ways before writing it down:

1. The table above (already a median of 3 runs).
2. An isolated A/B on the large scenario alone, Helios vs Fastify, outside
   the full four-framework run's machine conditions — same gap reproduced.
3. **Causal isolation, not just correlation**: the same Fastify server, same
   2,000-item payload, but with the response schema *removed* (plain
   `JSON.stringify` instead) — throughput jumped to match Helios almost
   exactly. Schema on costs Fastify roughly 20% at this size; schema off
   erases the gap entirely. It's specifically `fast-json-stringify`, not
   routing, not the HTTP layer, not noise.

This tracks with a real, independently-documented characteristic of
`fast-json-stringify`: it walks the declared schema per array item rather
than using V8's own heavily-optimized native `JSON.stringify`, and that
per-item schema-walk cost compounds across a large array faster than the
upfront schema-compilation savings pay for. Small, typical API responses —
the shape most endpoints actually return — are exactly where the
schema-compiled path wins; large arrays are exactly where it can lose. Both
this page and the main routing page are telling the truth about Fastify:
one measures the shape where it wins outright, this one measures a shape
where it doesn't.
