import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autocannon from 'autocannon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Each framework is measured multiple times in its own process, after a
// discarded warmup run, and reported as a median — see "Methodology" in
// helios-docs/docs/benchmarks.md for why (process isolation, no pipelining,
// median-of-N are what keep this comparable to real production traffic
// instead of a single noisy sample).
const DURATION = Number(process.env.BENCH_DURATION ?? 8);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 100);
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const WARMUP_DURATION = 2;
const BASE_PORT = 4100;
const READY_TIMEOUT = 10_000;

const FRAMEWORKS = [
  { name: 'Helios', file: 'helios.js' },
  { name: 'Express', file: 'express.js' },
  { name: 'Fastify', file: 'fastify.js' },
  { name: 'NestJS', file: 'nestjs.js' },
] as const;

const SCENARIOS = [
  { name: 'GET /users (static route)', path: '/users' },
  { name: 'GET /users/:id (param route)', path: '/users/42' },
] as const;

interface BenchResult {
  requests: { average: number };
  latency: { average: number; p99: number };
  throughput: { average: number };
}

interface FrameworkSummary {
  name: string;
  reqPerSec: number;
  latencyAvg: number;
  latencyP99: number;
  throughputMBs: number;
}

function startServer(file: string, port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, 'servers', file), {
      env: { ...process.env, PORT: String(port) },
      silent: true,
    });
    child.stderr?.pipe(process.stderr);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${file} did not signal ready within ${READY_TIMEOUT}ms`));
    }, READY_TIMEOUT);
    child.once('message', (msg) => {
      if (msg === 'ready') {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timer);
        reject(new Error(`${file} exited with code ${code}`));
      }
    });
  });
}

function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
}

function runAutocannon(url: string, duration: number): Promise<BenchResult> {
  return new Promise((resolve, reject) => {
    autocannon(
      { url, connections: CONNECTIONS, duration },
      (err: Error | null, result: BenchResult) => (err ? reject(err) : resolve(result))
    );
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function benchmarkFramework(
  file: string,
  port: number
): Promise<Record<string, FrameworkSummary>> {
  const child = await startServer(file, port);
  try {
    const byScenario: Record<string, FrameworkSummary> = {};
    for (const scenario of SCENARIOS) {
      const url = `http://127.0.0.1:${port}${scenario.path}`;
      await runAutocannon(url, WARMUP_DURATION); // discarded
      const samples: BenchResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        samples.push(await runAutocannon(url, DURATION));
      }
      byScenario[scenario.name] = {
        name: scenario.name,
        reqPerSec: median(samples.map((s) => s.requests.average)),
        latencyAvg: median(samples.map((s) => s.latency.average)),
        latencyP99: median(samples.map((s) => s.latency.p99)),
        throughputMBs: median(samples.map((s) => s.throughput.average)) / 1024 / 1024,
      };
    }
    return byScenario;
  } finally {
    await stopServer(child);
  }
}

function printTable(scenarioName: string, rows: FrameworkSummary[]) {
  const sorted = [...rows].sort((a, b) => b.reqPerSec - a.reqPerSec);
  console.log(`\n${scenarioName}`);
  console.log('─'.repeat(72));
  console.log(
    `  ${'Framework'.padEnd(10)} | ${'Req/sec'.padStart(10)} | ${'Latency avg'.padStart(
      11
    )} | ${'Latency p99'.padStart(11)} | ${'Throughput'.padStart(10)}`
  );
  console.log('─'.repeat(72));
  for (const r of sorted) {
    console.log(
      `  ${r.name.padEnd(10)} | ${Math.round(r.reqPerSec).toLocaleString().padStart(10)} | ${(
        r.latencyAvg.toFixed(2) + ' ms'
      ).padStart(11)} | ${(r.latencyP99.toFixed(2) + ' ms').padStart(11)} | ${(
        r.throughputMBs.toFixed(2) + ' MB/s'
      ).padStart(10)}`
    );
  }
  console.log('─'.repeat(72));
}

async function main() {
  const cpus = os.cpus();
  console.log(`HeliosJS Benchmark: Helios vs Express vs Fastify vs NestJS`);
  console.log(
    `${os.type()} ${os.release()} | Node ${process.version} | ${cpus.length}x ${
      cpus[0]?.model ?? 'unknown CPU'
    }`
  );
  console.log(
    `${RUNS} runs x ${DURATION}s (+${WARMUP_DURATION}s discarded warmup), ${CONNECTIONS} connections, no pipelining. Each framework runs isolated in its own process.`
  );

  const perScenario: Record<string, FrameworkSummary[]> = {};
  for (const s of SCENARIOS) perScenario[s.name] = [];

  for (const [i, { name, file }] of FRAMEWORKS.entries()) {
    console.log(`\nBenchmarking ${name}...`);
    const byScenario = await benchmarkFramework(file, BASE_PORT + i);
    for (const s of SCENARIOS) {
      perScenario[s.name].push({ ...byScenario[s.name], name });
    }
  }

  console.log('\n' + '═'.repeat(72));
  console.log('  RESULTS (median of ' + RUNS + ' runs)');
  console.log('═'.repeat(72));
  for (const s of SCENARIOS) {
    printTable(s.name, perScenario[s.name]);
  }
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
