# Benchmark Baseline

Date: 2026-09-10
Machine: macOS, Node v24.14.0
Config: 100 connections, 10 pipelining, 10s duration

## Baseline (before optimizations)

| Framework | Req/sec | Latency avg | Latency max | Throughput |
| --------- | ------- | ----------- | ----------- | ---------- |
| Helios    | 72,928  | 13.31 ms    | 424 ms      | 15.32 MB/s |
| Express   | 65,901  | 14.75 ms    | 435 ms      | 14.65 MB/s |
| Fastify   | 101,248 | 9.41 ms     | 281 ms      | 19.74 MB/s |

## Phase 1 Results

### 1.1 Pre-compile route regex

- [ ] Helios: **_k req/s (delta: _**%)

### 1.2 Lazy body parsing

- [ ] Helios: **_k req/s (delta: _**%)

### 1.3 Single URL allocation

- [ ] Helios: **_k req/s (delta: _**%)

### 1.4 Pre-partition middleware

- [ ] Helios: **_k req/s (delta: _**%)

### Phase 1 Total

- [ ] Helios: **_k req/s (delta: _**%)

## Phase 2 Results

### 2.1 Flat middleware chain

- [ ] Helios: **_k req/s (delta: _**%)

### 2.2 Cache guard instances

- [ ] Helios: **_k req/s (delta: _**%)

### 2.3 Pre-compiled param resolver

- [ ] Helios: **_k req/s (delta: _**%)

### Phase 2 Total

- [ ] Helios: **_k req/s (delta: _**%)

## Phase 3 Results

### 3.1 Schema-based serialization

- [ ] Helios: **_k req/s (delta: _**%)

### 3.2 Radix tree router

- [ ] Helios: **_k req/s (delta: _**%)

## Final Results

| Framework | Req/sec | Latency avg | Latency max | Throughput |
| --------- | ------- | ----------- | ----------- | ---------- |
| Helios    |         |             |             |            |
| Express   |         |             |             |            |
| Fastify   |         |             |             |            |
