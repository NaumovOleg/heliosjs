---
sidebar_position: 22
description: Request-body validation cost — Helios/NestJS on class-validator, Express manual, Fastify's native JSON Schema/Ajv, and Helios's own JSON Schema/Ajv path.
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
to every server below.

| Server | Path | Library |
| ------ | ---- | ------- |
| Helios | `@Body(CreateOrderDto)` — automatic, no extra pipe to wire up | `class-validator` / `class-transformer` |
| Helios (Ajv) | `@Body(compileSchema(orderSchema))` — see [Validation](./core-module/validation#fast-path-json-schema-with-compileschema) | native JSON Schema, compiled by Ajv |
| NestJS | `@Body() dto: CreateOrderDto` + `app.useGlobalPipes(new ValidationPipe({ transform: true }))` | `class-validator` / `class-transformer` |
| Express | No built-in convention — `plainToInstance` + `validate()` called manually in the route handler | `class-validator` / `class-transformer` |
| Fastify | A declared route `schema.body` | native JSON Schema, compiled by Fastify's built-in Ajv |

Helios, NestJS, and Express share the **same DTO class** (same
`class-validator` decorators, same rules) — only the framework integration
differs between those three. Fastify has no class to share; its schema
re-expresses the same field rules in JSON Schema. Helios (Ajv) uses that
identical JSON Schema again, through `compileSchema()`, so it's directly
comparable to Fastify's number, not just to Helios's own class-validator row.

## Results

Captured 2026-09-11, same machine/config as the main page.

<BenchChart title="POST /validate (one fixed valid payload)" data={{ Fastify: 68752, 'Helios (Ajv)': 68400, Helios: 41168, Express: 35936, NestJS: 32776 }} />

| Framework | Req/sec | Latency avg | Library |
| --------- | ------: | -----------: | ------- |
| Fastify       |  68,752 | 1.12 ms      | JSON Schema / Ajv |
| Helios (Ajv)  |  68,400 | 1.02 ms      | JSON Schema / Ajv |
| Helios        |  41,168 | 2.03 ms      | class-validator |
| Express       |  35,936 | 2.05 ms      | class-validator (manual) |
| NestJS        |  32,776 | 2.59 ms      | class-validator |

### Reading these numbers

- **Helios (Ajv) is within 0.5% of Fastify** — same underlying mechanism
  (a schema compiled once into a plain validator function), so the two land
  together, both far ahead of every class-validator path here.
- **class-validator's per-request reflection is the actual cost, not Helios's
  request pipeline** — switching only the validation path (same route, same
  payload, same handler) takes Helios from 41,168 to 68,400 req/s, a 1.66x
  jump. `@Body(CreateOrderDto)` stays the default for the class-based DX;
  reach for `compileSchema()` (see [Validation](./core-module/validation#fast-path-json-schema-with-compileschema))
  when this path is hot.
- **Among the three `class-validator` users — same library, same rules —
  Helios is still fastest**, ahead of both Express's manual call and NestJS's
  own `ValidationPipe`.
