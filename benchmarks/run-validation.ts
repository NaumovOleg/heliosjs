// Validation suite — Part 1, suite 2 of BENCHMARK-SUITE-PLAN.md. Same
// methodology as run.ts/run-middleware.ts (process-isolated, discarded
// warmup, median-of-N, via lib/harness.ts). Each framework validates one
// fixed payload (lib/validate-dto.ts's VALID_ORDER_PAYLOAD) against its own
// idiomatic path — Helios/Express/NestJS via class-validator (same library,
// same rules — the DTO is shared, not reimplemented per server), Fastify via
// its own native JSON Schema/Ajv. The `library` column exists specifically
// so a reader sees which mechanism produced each number without digging
// into the server files — see the plan doc's fairness note on this suite.
import 'reflect-metadata'; // validate-dto.ts's decorators need Reflect.getMetadata
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
import { VALID_ORDER_PAYLOAD } from './lib/validate-dto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.join(__dirname, '..', 'results-validation.csv');

const DURATION = Number(process.env.BENCH_DURATION ?? 8);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 100);
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const WARMUP_DURATION = 2;
const BASE_PORT = 4400;

const FRAMEWORKS = [
  { name: 'Helios', file: 'helios-validate.js', library: 'class-validator' },
  { name: 'Express', file: 'express-validate.js', library: 'class-validator (manual)' },
  { name: 'Fastify', file: 'fastify-validate.js', library: 'JSON Schema / Ajv' },
  { name: 'NestJS', file: 'nestjs-validate.js', library: 'class-validator' },
] as const;

const BODY = JSON.stringify(VALID_ORDER_PAYLOAD);

interface FrameworkResult {
  name: string;
  library: string;
  reqPerSec: number;
  latencyAvg: number;
  latencyP99: number;
}

async function benchmarkFramework(file: string, port: number): Promise<BenchResult[]> {
  const child = await startServer(path.join(__dirname, 'servers', file), port);
  try {
    const url = `http://127.0.0.1:${port}/validate`;
    const extra = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: BODY,
    } as const;
    await runAutocannon(url, WARMUP_DURATION, CONNECTIONS, extra); // discarded
    const samples: BenchResult[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(await runAutocannon(url, DURATION, CONNECTIONS, extra));
    }
    return samples;
  } finally {
    await stopServer(child);
  }
}

function printResults(results: FrameworkResult[]) {
  const sorted = [...results].sort((a, b) => b.reqPerSec - a.reqPerSec);
  console.log('\n' + '═'.repeat(90));
  console.log(`  RESULTS (median of ${RUNS} runs) — POST /validate, one fixed valid payload`);
  console.log('═'.repeat(90));
  console.log(
    `  ${'Framework'.padEnd(10)} | ${'Req/sec'.padStart(10)} | ${'Latency avg'.padStart(
      11
    )} | ${'Latency p99'.padStart(11)} | Library`
  );
  console.log('─'.repeat(90));
  for (const r of sorted) {
    console.log(
      `  ${r.name.padEnd(10)} | ${Math.round(r.reqPerSec).toLocaleString().padStart(10)} | ${(
        r.latencyAvg.toFixed(2) + ' ms'
      ).padStart(11)} | ${(r.latencyP99.toFixed(2) + ' ms').padStart(11)} | ${r.library}`
    );
  }
  console.log('─'.repeat(90));
}

function appendResults(results: FrameworkResult[]) {
  const date = new Date().toISOString();
  const commit = getCommit(__dirname);
  const node = process.version;
  const platform = `${os.type()} ${os.release()}`;

  const rows = results.map((r) =>
    [
      date,
      commit,
      node,
      platform,
      r.name,
      r.library,
      Math.round(r.reqPerSec),
      r.latencyAvg.toFixed(2),
      r.latencyP99.toFixed(2),
    ]
      .map(csvField)
      .join(',')
  );

  appendCsvRows(
    RESULTS_FILE,
    'date,commit,node,os,framework,library,reqPerSec,latencyAvgMs,latencyP99Ms',
    rows
  );
  console.log(`\nAppended ${rows.length} rows to ${path.relative(process.cwd(), RESULTS_FILE)}`);
}

async function main() {
  const cpus = os.cpus();
  console.log('HeliosJS Benchmark: validation suite (Helios vs Express vs Fastify vs NestJS)');
  console.log(
    `${os.type()} ${os.release()} | Node ${process.version} | ${cpus.length}x ${
      cpus[0]?.model ?? 'unknown CPU'
    }`
  );
  console.log(
    `${RUNS} runs x ${DURATION}s (+${WARMUP_DURATION}s discarded warmup), ${CONNECTIONS} connections, each framework's own idiomatic validation path (see servers/*-validate.ts).`
  );

  const results: FrameworkResult[] = [];
  for (const [i, { name, file, library }] of FRAMEWORKS.entries()) {
    console.log(`\nBenchmarking ${name}...`);
    const samples = await benchmarkFramework(file, BASE_PORT + i);
    results.push({
      name,
      library,
      reqPerSec: median(samples.map((s) => s.requests.average)),
      latencyAvg: median(samples.map((s) => s.latency.average)),
      latencyP99: median(samples.map((s) => s.latency.p99)),
    });
  }

  printResults(results);
  appendResults(results);
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
