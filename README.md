# HeliosJS

🎯 A modern decorator-based Node.js framework for building scalable applications.

## Documentation

👉 **[Full Documentation](https://naumovoleg.github.io/heliosjs/)**

See [`STABILITY.md`](./STABILITY.md) for the versioning policy — what counts
as a breaking change, support windows, and which packages version together.

## Packages

| Package                                                                                              | Version | Description             |
| ---------------------------------------------------------------------------------------------------- | ------- | ----------------------- |
| [@heliosjs/core](https://github.com/NaumovOleg/heliosjs/tree/master/src/core)                        |         | Core decorators and DI  |
| [@heliosjs/http](https://github.com/NaumovOleg/heliosjs/tree/master/src/http)                        |         | HTTP server and routing |
| [@heliosjs/middlewares](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/middlewares) |         | Built-in middlewares    |
| [@heliosjs/aws](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/aws)                 |         | Aws support             |
| [@heliosjs/grpc](https://github.com/NaumovOleg/heliosjs/tree/master/packages/src/grpc)               |         | Grpc support            |

## Quick Start

```bash
npm install @heliosjs/core @heliosjs/http reflect-metadata
```

## Benchmarks

| Framework   | Req/sec     | Latency (avg) | Throughput |
| ----------- | ----------- | -------------- | ---------- |
| **Fastify** | **113,560** | 0.05 ms        | 22.31 MB/s |
| **Helios**  | 89,184      | 0.94 ms        | 18.03 MB/s |
| Express     | 70,936      | 1.02 ms        | 16.71 MB/s |
| NestJS      | 64,156      | 1.02 ms        | 16.52 MB/s |

> `GET /users`, 100 connections, 3×8s runs (median), no pipelining. [Full benchmarks & methodology](https://naumovoleg.github.io/heliosjs/docs/benchmarks) — including middleware, validation, and serialization suites.
