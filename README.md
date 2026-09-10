# HeliosJS

🎯 A modern decorator-based Node.js framework for building scalable applications.

## Documentation

👉 **[Full Documentation](https://naumovoleg.github.io/heliosjs/)**

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

| Framework   | Req/sec     | Latency (avg) | Latency (max) | Throughput |
| ----------- | ----------- | ------------- | ------------- | ---------- |
| **Fastify** | **102,861** | 9.31 ms       | 280 ms        | 20.21 MB/s |
| **Helios**  | 81,242      | 11.68 ms      | 383 ms        | 16.43 MB/s |
| Express     | 67,653      | 14.32 ms      | 434 ms        | 15.94 MB/s |

> 100 connections, pipelining 10, 10s duration. [Full benchmarks & methodology](https://naumovoleg.github.io/heliosjs/docs/benchmarks)
