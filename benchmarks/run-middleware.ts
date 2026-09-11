// Middleware-pipeline suite — Part 1, suite 1 of BENCHMARK-SUITE-PLAN.md.
// Same methodology as run.ts (routing suite): process-isolated per
// framework, discarded warmup, median-of-N — reused from lib/harness.ts
// rather than copy-pasted. What's different here: instead of comparing
// different *routes*, each framework serves the same payload behind 0, 3,
// and 6 layers of an identical no-op (see servers/helios.ts's noopMw
// comment) via its own idiomatic stacking mechanism — the question isn't
// "which framework is fastest" (run.ts already answers that) but "what does
// each additional layer cost, per framework" — report the slope, not just
// the numbers.
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
const RESULTS_FILE = path.join(__dirname, '..', 'results-middleware.csv');

const DURATION = Number(process.env.BENCH_DURATION ?? 8);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 100);
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const WARMUP_DURATION = 2;
const BASE_PORT = 4300;

const FRAMEWORKS = [
  { name: 'Helios', file: 'helios-middleware.js' },
  { name: 'Express', file: 'express-middleware.js' },
  { name: 'Fastify', file: 'fastify-middleware.js' },
  { name: 'NestJS', file: 'nestjs-middleware.js' },
] as const;

const LAYERS = [0, 3, 6] as const;

interface LayerResult {
  layers: number;
  reqPerSec: number;
  latencyAvg: number;
  latencyP99: number;
}

async function benchmarkFramework(file: string, port: number): Promise<LayerResult[]> {
  const child = await startServer(path.join(__dirname, 'servers', file), port);
  try {
    const results: LayerResult[] = [];
    for (const layers of LAYERS) {
      const url = `http://127.0.0.1:${port}/mw/${layers}`;
      await runAutocannon(url, WARMUP_DURATION, CONNECTIONS); // discarded
      const samples: BenchResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        samples.push(await runAutocannon(url, DURATION, CONNECTIONS));
      }
      results.push({
        layers,
        reqPerSec: median(samples.map((s) => s.requests.average)),
        latencyAvg: median(samples.map((s) => s.latency.average)),
        latencyP99: median(samples.map((s) => s.latency.p99)),
      });
    }
    return results;
  } finally {
    await stopServer(child);
  }
}

function printResults(perFramework: Record<string, LayerResult[]>) {
  console.log('\n' + '═'.repeat(84));
  console.log(`  RESULTS (median of ${RUNS} runs) — req/sec by middleware-layer count`);
  console.log('═'.repeat(84));
  console.log(
    `  ${'Framework'.padEnd(10)} | ${'0 layers'.padStart(10)} | ${'3 layers'.padStart(
      10
    )} | ${'6 layers'.padStart(10)} | ${'ns/layer'.padStart(10)}`
  );
  console.log('─'.repeat(84));
  for (const [name, results] of Object.entries(perFramework)) {
    const byLayers = Object.fromEntries(results.map((r) => [r.layers, r.reqPerSec]));
    // The fair cross-framework number isn't req/sec lost per layer — frameworks
    // start from very different baselines, and req/sec vs. per-request time
    // aren't linearly related, so the same *time* cost per layer shows up as a
    // bigger req/sec drop for whichever framework has the higher baseline.
    // Converting through 1/reqPerSec (time per request) removes that skew.
    const nsPerLayer = ((1e6 / byLayers[6] - 1e6 / byLayers[0]) / 6) * 1000;
    console.log(
      `  ${name.padEnd(10)} | ${Math.round(byLayers[0]).toLocaleString().padStart(10)} | ${Math.round(
        byLayers[3]
      )
        .toLocaleString()
        .padStart(10)} | ${Math.round(byLayers[6]).toLocaleString().padStart(10)} | ${Math.round(
        nsPerLayer
      )
        .toString()
        .padStart(10)}`
    );
  }
  console.log('─'.repeat(84));
}

function appendResults(perFramework: Record<string, LayerResult[]>) {
  const date = new Date().toISOString();
  const commit = getCommit(__dirname);
  const node = process.version;
  const platform = `${os.type()} ${os.release()}`;

  const rows = Object.entries(perFramework).flatMap(([framework, results]) =>
    results.map((r) =>
      [date, commit, node, platform, framework, r.layers, Math.round(r.reqPerSec), r.latencyAvg.toFixed(2), r.latencyP99.toFixed(2)]
        .map(csvField)
        .join(',')
    )
  );

  appendCsvRows(
    RESULTS_FILE,
    'date,commit,node,os,framework,layers,reqPerSec,latencyAvgMs,latencyP99Ms',
    rows
  );
  console.log(`\nAppended ${rows.length} rows to ${path.relative(process.cwd(), RESULTS_FILE)}`);
}

async function main() {
  const cpus = os.cpus();
  console.log('HeliosJS Benchmark: middleware-pipeline suite (Helios vs Express vs Fastify vs NestJS)');
  console.log(
    `${os.type()} ${os.release()} | Node ${process.version} | ${cpus.length}x ${
      cpus[0]?.model ?? 'unknown CPU'
    }`
  );
  console.log(
    `${RUNS} runs x ${DURATION}s (+${WARMUP_DURATION}s discarded warmup), ${CONNECTIONS} connections, 0/3/6 no-op layers per framework's own idiom (see servers/*.ts).`
  );

  const perFramework: Record<string, LayerResult[]> = {};
  for (const [i, { name, file }] of FRAMEWORKS.entries()) {
    console.log(`\nBenchmarking ${name}...`);
    perFramework[name] = await benchmarkFramework(file, BASE_PORT + i);
  }

  printResults(perFramework);
  appendResults(perFramework);
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
