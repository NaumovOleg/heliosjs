// Serialization suite — Part 1, suite 3 (last one) of BENCHMARK-SUITE-PLAN.md.
// Same methodology as the other suites (process-isolated, discarded warmup,
// median-of-N, via lib/harness.ts). Unlike the routing suite's benchmarks/
// servers — deliberately not touched — Fastify here runs *with* a declared
// response schema (its real idiomatic serialization path, compiled to
// fast-json-stringify); the other three use plain JSON.stringify, since none
// has an equivalent to enable. That's the whole point of this suite: measure
// the gap the routing suite's docs explicitly don't.
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
const RESULTS_FILE = path.join(__dirname, '..', 'results-serialization.csv');

const DURATION = Number(process.env.BENCH_DURATION ?? 8);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 100);
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const WARMUP_DURATION = 2;
const BASE_PORT = 4500;

const FRAMEWORKS = [
  { name: 'Helios', file: 'helios-serialize.js', method: 'JSON.stringify' },
  { name: 'Express', file: 'express-serialize.js', method: 'JSON.stringify (res.json)' },
  { name: 'Fastify', file: 'fastify-serialize.js', method: 'fast-json-stringify (schema)' },
  { name: 'NestJS', file: 'nestjs-serialize.js', method: 'JSON.stringify' },
] as const;

const SCENARIOS = [
  { name: 'small (1 object, 5 fields)', path: '/serialize/small' },
  { name: 'medium (100-item array)', path: '/serialize/medium' },
  { name: 'large (2,000-item array)', path: '/serialize/large' },
] as const;

interface ScenarioResult {
  scenario: string;
  reqPerSec: number;
  latencyAvg: number;
  throughputMBs: number;
}

async function benchmarkFramework(
  file: string,
  port: number
): Promise<Record<string, ScenarioResult>> {
  const child = await startServer(path.join(__dirname, 'servers', file), port);
  try {
    const byScenario: Record<string, ScenarioResult> = {};
    for (const scenario of SCENARIOS) {
      const url = `http://127.0.0.1:${port}${scenario.path}`;
      await runAutocannon(url, WARMUP_DURATION, CONNECTIONS); // discarded
      const samples: BenchResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        samples.push(await runAutocannon(url, DURATION, CONNECTIONS));
      }
      byScenario[scenario.name] = {
        scenario: scenario.name,
        reqPerSec: median(samples.map((s) => s.requests.average)),
        latencyAvg: median(samples.map((s) => s.latency.average)),
        throughputMBs: median(samples.map((s) => s.throughput.average)) / 1024 / 1024,
      };
    }
    return byScenario;
  } finally {
    await stopServer(child);
  }
}

function printResults(perScenario: Record<string, { name: string; method: string; r: ScenarioResult }[]>) {
  for (const [scenarioName, rows] of Object.entries(perScenario)) {
    const sorted = [...rows].sort((a, b) => b.r.reqPerSec - a.r.reqPerSec);
    console.log(`\n${scenarioName}`);
    console.log('─'.repeat(90));
    console.log(
      `  ${'Framework'.padEnd(10)} | ${'Req/sec'.padStart(10)} | ${'Latency avg'.padStart(
        11
      )} | ${'Throughput'.padStart(10)} | Method`
    );
    console.log('─'.repeat(90));
    for (const { name, method, r } of sorted) {
      console.log(
        `  ${name.padEnd(10)} | ${Math.round(r.reqPerSec).toLocaleString().padStart(10)} | ${(
          r.latencyAvg.toFixed(2) + ' ms'
        ).padStart(11)} | ${(r.throughputMBs.toFixed(2) + ' MB/s').padStart(10)} | ${method}`
      );
    }
    console.log('─'.repeat(90));
  }
}

function appendResults(
  perFramework: Record<string, { method: string; results: Record<string, ScenarioResult> }>
) {
  const date = new Date().toISOString();
  const commit = getCommit(__dirname);
  const node = process.version;
  const platform = `${os.type()} ${os.release()}`;

  const rows = Object.entries(perFramework).flatMap(([framework, { method, results }]) =>
    Object.values(results).map((r) =>
      [
        date,
        commit,
        node,
        platform,
        framework,
        method,
        r.scenario,
        Math.round(r.reqPerSec),
        r.latencyAvg.toFixed(2),
        r.throughputMBs.toFixed(2),
      ]
        .map(csvField)
        .join(',')
    )
  );

  appendCsvRows(
    RESULTS_FILE,
    'date,commit,node,os,framework,method,scenario,reqPerSec,latencyAvgMs,throughputMBs',
    rows
  );
  console.log(`\nAppended ${rows.length} rows to ${path.relative(process.cwd(), RESULTS_FILE)}`);
}

async function main() {
  const cpus = os.cpus();
  console.log('HeliosJS Benchmark: serialization suite (Helios vs Express vs Fastify vs NestJS)');
  console.log(
    `${os.type()} ${os.release()} | Node ${process.version} | ${cpus.length}x ${
      cpus[0]?.model ?? 'unknown CPU'
    }`
  );
  console.log(
    `${RUNS} runs x ${DURATION}s (+${WARMUP_DURATION}s discarded warmup), ${CONNECTIONS} connections. Fastify runs with a declared response schema (fast-json-stringify); the other three use plain JSON.stringify.`
  );

  const perFramework: Record<string, { method: string; results: Record<string, ScenarioResult> }> = {};
  for (const [i, { name, file, method }] of FRAMEWORKS.entries()) {
    console.log(`\nBenchmarking ${name}...`);
    const results = await benchmarkFramework(file, BASE_PORT + i);
    perFramework[name] = { method, results };
  }

  const perScenario: Record<string, { name: string; method: string; r: ScenarioResult }[]> = {};
  for (const s of SCENARIOS) perScenario[s.name] = [];
  for (const [name, { method, results }] of Object.entries(perFramework)) {
    for (const s of SCENARIOS) {
      perScenario[s.name].push({ name, method, r: results[s.name] });
    }
  }

  console.log('\n' + '═'.repeat(90));
  console.log(`  RESULTS (median of ${RUNS} runs)`);
  console.log('═'.repeat(90));
  printResults(perScenario);
  appendResults(perFramework);
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
