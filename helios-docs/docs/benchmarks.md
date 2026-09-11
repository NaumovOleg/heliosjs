---
sidebar_position: 20
description: How to run HeliosJS's Helios vs Express vs Fastify throughput benchmark.
---

# Benchmarks

The repository ships a benchmark script (`benchmarks/run.ts`) that runs the
same small API — `GET /users`, `GET /users/:id`, `POST /users`, `GET /health`
— on Helios, [Express](https://expressjs.com/), and
[Fastify](https://fastify.dev/), then load-tests each with
[autocannon](https://github.com/mcollina/autocannon) and prints a comparison
table.

:::note
Throughput numbers are highly dependent on the machine, Node version, and
what else is running at the time — run the benchmark yourself rather than
trusting numbers quoted elsewhere (including outdated copies of this page).
:::

## Running It

From the repository root:

```bash
yarn benchmark
```

This runs `benchmark:build` (compiles `benchmarks/` with `tsc`) and then
executes the compiled script, which:

1. Starts all three servers on adjacent ports (`4000`–`4002`).
2. Load-tests each one in turn against `GET /users` with autocannon.
3. Prints requests/sec, average and max latency, and throughput (MB/s) for
   each framework, plus which one won this run.

## Methodology

| Setting        | Value                                          |
| --------------- | ----------------------------------------------- |
| Duration        | 10 seconds per framework                        |
| Connections     | 100 concurrent                                  |
| Pipelining      | 10 requests per connection                      |
| Endpoint tested | `GET /users` (returns a small static JSON array) |

All three servers implement identical routes with no database, validation,
or middleware — the benchmark measures raw routing/dispatch overhead, not a
realistic application. Treat the result as a relative comparison between the
three frameworks on your machine, not an absolute number to plan capacity
around.

## Reading the Output

```
  📊 RESULTS
═════════════════════════════════════════════════════════════════════════════════
  Framework  |      Req/sec | Latency avg | Latency max | Throughput
─────────────────────────────────────────────────────────────────────────────────
      Helios |   ...        | ...      ms | ...      ms |     ... MB/s
     Express |   ...        | ...      ms | ...      ms |     ... MB/s
     Fastify |   ...        | ...      ms | ...      ms |     ... MB/s
═════════════════════════════════════════════════════════════════════════════════

  🏆 Winner: ...
```

Run it locally (`yarn benchmark`) to see real numbers for your environment.

## Customizing

Edit `benchmarks/run.ts` to change `DURATION`, `CONNECTIONS`, `PIPELINING`, or
to add more routes/frameworks to the comparison, then re-run `yarn benchmark`.
