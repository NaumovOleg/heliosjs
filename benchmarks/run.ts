import 'reflect-metadata';
import http from 'node:http';
import autocannon from 'autocannon';
import { Helios, Server } from '@heliosjs/http';
import { Controller, Get, Post } from '@heliosjs/core';
import express from 'express';
import Fastify from 'fastify';

const DURATION = 10;
const CONNECTIONS = 100;
const PIPELINING = 10;

interface BenchResult {
  requests: { average: number; total: number };
  latency: { average: number; max: number };
  throughput: { average: number };
}

// --- Helios ---
@Controller('/users')
class UsersBenchmarkCtrl {
  @Get('/')
  list() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @Get('/:id')
  getOne() {
    return { id: '42', name: 'widget', price: 9.99 };
  }
  @Post('/')
  create() {
    return { created: true };
  }
}

@Controller('/health')
class HealthBenchmarkCtrl {
  @Get('/')
  check() {
    return { status: 'ok' };
  }
}

@Server({ port: 0 })
class BenchApp {}

function startHelios(port: number): Promise<http.Server> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = new Helios(BenchApp as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).config.controllers = [UsersBenchmarkCtrl, HealthBenchmarkCtrl];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).rootControllers = (app as any).compileControllers([
    UsersBenchmarkCtrl,
    HealthBenchmarkCtrl,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).controllers = (app as any).collectControllers([
    UsersBenchmarkCtrl,
    HealthBenchmarkCtrl,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = (app as any).app as http.Server;
  return new Promise<http.Server>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function startExpress(port: number): Promise<http.Server> {
  const app = express();
  app.disable('x-powered-by');
  app.get('/users', (_req, res) => res.json({ users: ['alice', 'bob', 'charlie'] }));
  app.get('/users/:id', (_req, res) => res.json({ id: '42', name: 'widget', price: 9.99 }));
  app.post('/users', (_req, res) => res.json({ created: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function startFastify(port: number): Promise<http.Server> {
  const app = Fastify();
  app.get('/users', async () => ({ users: ['alice', 'bob', 'charlie'] }));
  app.get('/users/:id', async () => ({ id: '42', name: 'widget', price: 9.99 }));
  app.post('/users', async () => ({ created: true }));
  app.get('/health', async () => ({ status: 'ok' }));
  return new Promise<http.Server>((resolve, reject) => {
    app
      .listen({ port, host: '127.0.0.1' })
      .then(() => resolve(app.server))
      .catch(reject);
  });
}

function bench(_name: string, port: number): Promise<BenchResult> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `http://127.0.0.1:${port}/users`,
        connections: CONNECTIONS,
        pipelining: PIPELINING,
        duration: DURATION,
      },
      (err: Error | null, result: BenchResult) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function printResult(name: string, r: BenchResult) {
  const reqs = r.requests.average;
  const latAvg = r.latency.average;
  const latMax = r.latency.max;
  const tp = (r.throughput.average / 1024 / 1024).toFixed(2);
  const pad = (s: string, n: number) => s.padStart(n);
  console.log(
    `  ${pad(name, 10)} | ${pad(reqs.toLocaleString(), 12)} req/s | avg ${pad(
      latAvg.toFixed(2),
      8
    )} ms | max ${pad(latMax.toFixed(2), 8)} ms | ${pad(tp, 7)} MB/s`
  );
}

async function main() {
  console.log(`\n🚀 HeliosJS Benchmark: Helios vs Express vs Fastify`);
  console.log(
    `   Duration: ${DURATION}s | Connections: ${CONNECTIONS} | Pipelining: ${PIPELINING}\n`
  );

  const servers: http.Server[] = [];

  try {
    console.log('Starting servers...');
    servers.push(await startHelios(4000));
    console.log('  ✅ Helios on :4000');
    servers.push(await startExpress(4001));
    console.log('  ✅ Express on :4001');
    servers.push(await startFastify(4002));
    console.log('  ✅ Fastify on :4002');

    const results: [string, BenchResult][] = [];

    console.log('\n🔥 Benchmarking Helios...');
    results.push(['Helios', await bench('Helios', 4000)]);

    console.log('🔥 Benchmarking Express...');
    results.push(['Express', await bench('Express', 4001)]);

    console.log('🔥 Benchmarking Fastify...');
    results.push(['Fastify', await bench('Fastify', 4002)]);

    console.log('\n' + '═'.repeat(85));
    console.log('  📊 RESULTS');
    console.log('═'.repeat(85));
    console.log(
      `  ${'Framework'.padEnd(10)} | ${'Req/sec'.padStart(12)} | ${'Latency avg'.padStart(
        10
      )} | ${'Latency max'.padStart(10)} | ${'Throughput'.padStart(8)}`
    );
    console.log('─'.repeat(85));
    for (const [name, r] of results) {
      printResult(name, r);
    }
    console.log('═'.repeat(85));

    const fastest = results.reduce((a, b) =>
      b[1].requests.average > a[1].requests.average ? b : a
    );
    console.log(
      `\n  🏆 Winner: ${fastest[0]} (${fastest[1].requests.average.toLocaleString()} req/s)\n`
    );
  } finally {
    for (const s of servers) {
      await new Promise<void>((r) => s.close(() => r()));
    }
  }
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
