---
sidebar_position: 22
description: Request-body validation cost — Helios/NestJS on class-validator, Express manual, Fastify's native JSON Schema/Ajv.
---

import BenchChart from '@site/src/components/BenchChart';

# Benchmarks: validation

Cost of validating a request body, using each framework's own idiomatic
path — not one library benchmarked identically four times. Same process-
isolation/warmup/median-of-3 methodology as the [main benchmarks
page](./benchmarks#methodology); each framework runs its own dedicated
server (see the [middleware page](./benchmarks-middleware) for why that
matters here).

## The payload

One fixed, valid `POST /validate` body — a representative "create order"
shape: 6 top-level fields (string, email, bounded integer, boolean,
optional string) plus a nested array of address objects, so array/nested
validation cost shows up too, not just flat-field checks. Same shape sent
to all four frameworks.

| Framework | Path | Library |
| --------- | ---- | ------- |
| Helios    | `@Body(CreateOrderDto)` — automatic, no extra pipe to wire up | `class-validator` / `class-transformer` |
| NestJS    | `@Body() dto: CreateOrderDto` + `app.useGlobalPipes(new ValidationPipe({ transform: true }))` | `class-validator` / `class-transformer` |
| Express   | No built-in convention — `plainToInstance` + `validate()` called manually in the route handler | `class-validator` / `class-transformer` |
| Fastify   | A declared route `schema.body` | native JSON Schema, compiled by Fastify's built-in Ajv |

Helios, NestJS, and Express share the **same DTO class** (same
`class-validator` decorators, same rules) — only the framework integration
differs between those three. Fastify has no class to share; its schema
re-expresses the same field rules in JSON Schema instead, since Ajv is its
real, idiomatic validation path.

## Results

Captured 2026-09-11, same machine/config as the main page.

<BenchChart title="POST /validate (one fixed valid payload)" data={{ Fastify: 70520, Helios: 41112, Express: 36428, NestJS: 32734 }} />

| Framework | Req/sec | Latency avg | Library |
| --------- | ------: | -----------: | ------- |
| Fastify   |  70,520 | 1.12 ms      | JSON Schema / Ajv |
| Helios    |  41,112 | 2.03 ms      | class-validator |
| Express   |  36,428 | 2.05 ms      | class-validator (manual) |
| NestJS    |  32,734 | 2.60 ms      | class-validator |

### Reading these numbers

- **Fastify wins by a wide margin** — its native, schema-compiled path is a
  structurally different mechanism from the other three, same framing as
  the routing page's Fastify-wins note.
- **Among the three `class-validator` users — same library, same rules —
  Helios is fastest**, ahead of both Express's manual call and NestJS's own
  `ValidationPipe`. Not just "no slower than manual," measurably ahead of
  both the manual baseline and the other framework's idiomatic mechanism.
