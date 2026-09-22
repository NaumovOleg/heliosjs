# HeliosJS

🎯 A modern decorator-based Node.js framework for building scalable applications.

## Documentation

👉 **[Full Documentation](https://naumovoleg.github.io/heliosjs/)**

See [`STABILITY.md`](./STABILITY.md) for the versioning policy — what counts
as a breaking change, support windows, and which packages version together.

## Packages

| Package                                                                                              | Version | Description                           |
| ---------------------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| [@heliosjs/core](https://github.com/NaumovOleg/heliosjs/tree/master/src/core)                        | 4.0.6   | Decorators, routing, request pipeline |
| [@heliosjs/http](https://github.com/NaumovOleg/heliosjs/tree/master/src/http)                        | 11.0.3  | HTTP server, WebSocket, SSE, GraphQL  |
| [@heliosjs/middlewares](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/middlewares) | 11.0.3  | `@Guard`, `@Pipe`, `@Intercept`, …    |
| [@heliosjs/aws](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/aws)                 | 11.0.3  | AWS Lambda adapter                    |
| [@heliosjs/azure](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/azure)             | 1.0.0   | Azure Functions adapter               |
| [@heliosjs/grpc](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/grpc)               | 2.1.19  | gRPC server + client                  |

There's no dependency-injection container — routes are precompiled at
construction time, not resolved through an IoC graph. That's a deliberate
tradeoff, not a gap: see the benchmarks below for what it buys.

## Quick Start

```bash
npm install @heliosjs/core @heliosjs/http reflect-metadata
```

## Benchmarks

| Framework   | Req/sec     | Latency (avg) | Throughput |
| ----------- | ----------- | -------------- | ---------- |
| **Fastify** | **122,888** | 0.05 ms        | 24.14 MB/s |
| **Helios**  | 89,808      | 0.98 ms        | 18.16 MB/s |
| Express     | 72,672      | 1.02 ms        | 17.12 MB/s |
| NestJS      | 65,810      | 1.03 ms        | 16.95 MB/s |

> `GET /users`, 100 connections, 3×8s runs (median), no pipelining. [Full benchmarks & methodology](https://naumovoleg.github.io/heliosjs/docs/benchmarks) — including a 300-route routing-at-scale suite, middleware, validation, and serialization.
