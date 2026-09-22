// Routing-scale suite — added for the route-trie rewrite
// (.planning/phases/01-route-trie/01-01-PLAN.md). run.ts's routing suite only
// has 2 routes, so it can't show whether a route's position in the table costs
// anything. This suite serves the same 300-route table (see
// servers/helios-routes.ts) and measures the first-declared route, a
// middle one, the last-declared static route, the last-declared param route,
// and a 404 — the shape that's most exposed to a linear scan. Fastify is the
// radix-tree reference; Express/NestJS are deliberately skipped, this isn't a
// full framework comparison.
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
const RESULTS_FILE = path.join(__dirname, '..', 'results-routes.csv');

const DURATION = Number(process.env.BENCH_DURATION ?? 8);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 100);
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const WARMUP_DURATION = 2;
const BASE_PORT = 4600;

const FRAMEWORKS = [
  { name: 'Helios', file: 'helios-routes.js' },
  { name: 'Fastify', file: 'fastify-routes.js' },
] as const;

const URLS = [
  { name: 'first-static', path: '/api/c0/s0' },
  { name: 'middle-static', path: '/api/c5/s12' },
  { name: 'last-static', path: '/api/c9/s24' },
  { name: 'last-param', path: '/api/c9/p3/42' },
  { name: '404', path: '/api/nope' },
] as const;

interface UrlResult {
  url: (typeof URLS)[number]['name'];
  reqPerSec: number;
  latencyAvg: number;
  latencyP99: number;
}

async function benchmarkFramework(file: string, port: number): Promise<UrlResult[]> {
  const child = await startServer(path.join(__dirname, 'servers', file), port);
  try {
    const results: UrlResult[] = [];
    for (const u of URLS) {
      const url = `http://127.0.0.1:${port}${u.path}`;
      await runAutocannon(url, WARMUP_DURATION, CONNECTIONS); // discarded
      const samples: BenchResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        samples.push(await runAutocannon(url, DURATION, CONNECTIONS));
      }
      results.push({
        url: u.name,
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

function printResults(perFramework: Record<string, UrlResult[]>) {
  console.log('\n' + '═'.repeat(92));
  console.log(`  RESULTS (median of ${RUNS} runs) — req/sec, 300-route table, by URL position`);
  console.log('═'.repeat(92));
  console.log(
    `  ${'Framework'.padEnd(10)} | ${URLS.map((u) => u.name.padStart(13)).join(' | ')}`
  );
  console.log('─'.repeat(92));
  for (const [name, results] of Object.entries(perFramework)) {
    const byUrl = Object.fromEntries(results.map((r) => [r.url, r.reqPerSec]));
    console.log(
      `  ${name.padEnd(10)} | ${URLS.map((u) =>
        Math.round(byUrl[u.name]).toLocaleString().padStart(13)
      ).join(' | ')}`
    );
  }
  console.log('─'.repeat(92));
  // The number this suite exists to answer: does the last route (or a miss)
  // cost more than the first, for the same table? Ratio, not absolute req/sec.
  for (const [name, results] of Object.entries(perFramework)) {
    const byUrl = Object.fromEntries(results.map((r) => [r.url, r.reqPerSec]));
    const firstVsLast = ((byUrl['last-static'] / byUrl['first-static']) * 100).toFixed(1);
    const firstVs404 = ((byUrl['404'] / byUrl['first-static']) * 100).toFixed(1);
    console.log(`  ${name}: last-static is ${firstVsLast}% of first-static, 404 is ${firstVs404}%`);
  }
}

function appendResults(perFramework: Record<string, UrlResult[]>) {
  const date = new Date().toISOString();
  const commit = getCommit(__dirname);
  const node = process.version;
  const platform = `${os.type()} ${os.release()}`;

  const rows = Object.entries(perFramework).flatMap(([framework, results]) =>
    results.map((r) =>
      [date, commit, node, platform, framework, r.url, Math.round(r.reqPerSec), r.latencyAvg.toFixed(2), r.latencyP99.toFixed(2)]
        .map(csvField)
        .join(',')
    )
  );

  appendCsvRows(
    RESULTS_FILE,
    'date,commit,node,os,framework,url,reqPerSec,latencyAvgMs,latencyP99Ms',
    rows
  );
  console.log(`\nAppended ${rows.length} rows to ${path.relative(process.cwd(), RESULTS_FILE)}`);
}

async function main() {
  const cpus = os.cpus();
  console.log('HeliosJS Benchmark: routing-scale suite (300-route table, Helios vs Fastify)');
  console.log(
    `${os.type()} ${os.release()} | Node ${process.version} | ${cpus.length}x ${
      cpus[0]?.model ?? 'unknown CPU'
    }`
  );
  console.log(
    `${RUNS} runs x ${DURATION}s (+${WARMUP_DURATION}s discarded warmup), ${CONNECTIONS} connections. 10 controllers x 30 routes (25 static, 4 param, 1 wildcard).`
  );

  const perFramework: Record<string, UrlResult[]> = {};
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
