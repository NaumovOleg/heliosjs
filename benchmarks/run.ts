import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendCsvRows,
  csvField,
  getCommit,
  median,
  runAutocannon,
  startServer,
  stopServer,
  type BenchResult,
} from './lib/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file runs compiled from benchmarks/dist/run.js (dist/ is gitignored),
// so __dirname is benchmarks/dist — go up one to land the results file in
// benchmarks/ itself, tracked by git. Every run appends instead of
// overwriting, so `git log -p` on this one file becomes the perf trend line
// instead of numbers only living in whichever markdown table someone last
// pasted them into.
const RESULTS_FILE = path.join(__dirname, '..', 'results.csv');

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

interface FrameworkSummary {
  name: string;
  reqPerSec: number;
  latencyAvg: number;
  latencyP99: number;
  throughputMBs: number;
}

async function benchmarkFramework(
  file: string,
  port: number
): Promise<Record<string, FrameworkSummary>> {
  const child = await startServer(path.join(__dirname, 'servers', file), port);
  try {
    const byScenario: Record<string, FrameworkSummary> = {};
    for (const scenario of SCENARIOS) {
      const url = `http://127.0.0.1:${port}${scenario.path}`;
      await runAutocannon(url, WARMUP_DURATION, CONNECTIONS); // discarded
      const samples: BenchResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        samples.push(await runAutocannon(url, DURATION, CONNECTIONS));
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

function appendResults(perScenario: Record<string, FrameworkSummary[]>) {
  const date = new Date().toISOString();
  const commit = getCommit(__dirname);
  const node = process.version;
  const platform = `${os.type()} ${os.release()}`;

  const rows = Object.entries(perScenario).flatMap(([scenario, results]) =>
    results.map((r) =>
      [
        date,
        commit,
        node,
        platform,
        scenario,
        r.name,
        Math.round(r.reqPerSec),
        r.latencyAvg.toFixed(2),
        r.latencyP99.toFixed(2),
        r.throughputMBs.toFixed(2),
      ]
        .map(csvField)
        .join(',')
    )
  );

  appendCsvRows(
    RESULTS_FILE,
    'date,commit,node,os,scenario,framework,reqPerSec,latencyAvgMs,latencyP99Ms,throughputMBs',
    rows
  );
  console.log(`\nAppended ${rows.length} rows to ${path.relative(process.cwd(), RESULTS_FILE)}`);
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

  appendResults(perScenario);
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
