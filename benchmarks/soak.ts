// Long-run stability check for Helios — not a comparative benchmark (that's
// run.ts), Helios's own story under sustained load. Two phases:
//
//   1. Memory/event-loop stability: sustained load for SOAK_DURATION seconds,
//      sampling RSS/heap/event-loop-lag every 5s via IPC (see the
//      SOAK_REPORT_STATS block in servers/helios.ts). Flags (doesn't hard-fail
//      by default — see SOAK_STRICT) if RSS trends up rather than plateauing.
//   2. Graceful-shutdown-under-load: a short burst of load, SIGTERM mid-run,
//      confirm in-flight requests still complete cleanly and the process
//      actually drains within a bounded time instead of hanging.
//
// Defaults are a ~30s CI-friendly smoke run; SOAK_DURATION=1800 (30 min) for
// a real manual soak.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutocannon, startServer, stopServer } from './lib/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_FILE = path.join(__dirname, 'servers', 'helios.js');

const DURATION_SEC = Number(process.env.SOAK_DURATION ?? 20);
const CONNECTIONS = Number(process.env.SOAK_CONNECTIONS ?? 50);
const SAMPLE_INTERVAL_SEC = 5;
// Ratio of last-quartile to first-quartile RSS beyond which this looks like a
// leak rather than normal warmup/GC noise. Heuristic, not a formal proof of
// absence of leaks — see the plan doc for why this is judged "good enough"
// for a CI smoke signal.
const RSS_GROWTH_WARN_RATIO = 1.5;
const STRICT = process.env.SOAK_STRICT === '1';

const SHUTDOWN_SIGTERM_AT_SEC = Number(process.env.SOAK_SHUTDOWN_SIGTERM_AT ?? 2);
const DRAIN_TIMEOUT_MS = 10_000;
// See the comment at its use site: this is a tolerance for TCP-teardown-race
// noise, not an admission that dropped requests are fine above this line.
const RESET_RATIO_WARN_THRESHOLD = 0.001; // 0.1%

interface StatSample {
  tSec: number;
  rssMb: number;
  heapUsedMb: number;
  eventLoopLagMs: number;
}

async function phase1MemoryStability(port: number): Promise<boolean> {
  console.log(
    `\nPhase 1: memory/event-loop stability — ${DURATION_SEC}s sustained load, ${CONNECTIONS} connections`
  );
  const child = await startServer(SERVER_FILE, port, { SOAK_REPORT_STATS: '1' });

  const samples: StatSample[] = [];
  const start = Date.now();
  child.on('message', (msg) => {
    const m = msg as { type?: string; rss?: number; heapUsed?: number; eventLoopLagMs?: number };
    if (m?.type !== 'stats') return;
    const sample = {
      tSec: Math.round((Date.now() - start) / 1000),
      rssMb: (m.rss ?? 0) / 1024 / 1024,
      heapUsedMb: (m.heapUsed ?? 0) / 1024 / 1024,
      eventLoopLagMs: m.eventLoopLagMs ?? 0,
    };
    samples.push(sample);
    console.log(
      `  t=${String(sample.tSec).padStart(4)}s  RSS=${sample.rssMb.toFixed(1).padStart(
        7
      )}MB  heap=${sample.heapUsedMb.toFixed(1).padStart(7)}MB  loopLag=${sample.eventLoopLagMs
        .toFixed(2)
        .padStart(6)}ms`
    );
  });

  let ok = true;
  try {
    await runAutocannon(`http://127.0.0.1:${port}/users`, DURATION_SEC, CONNECTIONS);
  } finally {
    await stopServer(child);
  }

  // Let any in-flight IPC stat message land before reading `samples`.
  await new Promise((r) => setTimeout(r, 100));

  if (samples.length < 4) {
    console.log(
      `  (only ${samples.length} samples at a ${SAMPLE_INTERVAL_SEC}s interval — run is too short to judge a trend; use SOAK_DURATION for a real soak.)`
    );
    return true;
  }

  const quartile = Math.max(1, Math.floor(samples.length / 4));
  const firstAvg = average(samples.slice(0, quartile).map((s) => s.rssMb));
  const lastAvg = average(samples.slice(-quartile).map((s) => s.rssMb));
  const ratio = lastAvg / firstAvg;
  console.log(
    `\n  RSS: first-quartile avg ${firstAvg.toFixed(1)}MB -> last-quartile avg ${lastAvg.toFixed(
      1
    )}MB (${ratio.toFixed(2)}x)`
  );
  if (ratio > RSS_GROWTH_WARN_RATIO) {
    console.log(
      `  ⚠ RSS grew ${ratio.toFixed(2)}x over the run (warn threshold ${RSS_GROWTH_WARN_RATIO}x) — looks like a leak, not just warmup. Longer SOAK_DURATION gives a more reliable signal than a short smoke run.`
    );
    ok = false;
  } else {
    console.log(`  ✓ RSS stayed within ${RSS_GROWTH_WARN_RATIO}x growth — no obvious leak.`);
  }
  return ok || !STRICT;
}

async function phase2ShutdownUnderLoad(port: number): Promise<boolean> {
  console.log(`\nPhase 2: graceful shutdown under load — SIGTERM at ${SHUTDOWN_SIGTERM_AT_SEC}s`);
  const child = await startServer(SERVER_FILE, port);

  const exited = new Promise<number>((resolve) => {
    child.once('exit', () => resolve(Date.now()));
  });

  // Deliberately raw (node:http + a small keep-alive Agent), not autocannon:
  // this needs to tell "a new connection was cleanly refused because the
  // server already stopped accepting work" (ECONNREFUSED — the *correct*,
  // desired outcome the instant close() runs) apart from "an in-flight
  // request got dropped mid-response" (ECONNRESET/ECONNRESET-equivalent —
  // the actual bug this test exists to catch). autocannon's aggregate
  // Result only exposes a single `errors` count with no per-code breakdown,
  // which can't make that distinction — tried it first, it couldn't
  // separate "shutdown working as intended" from "shutdown dropping
  // requests," which is exactly the thing this test needs to tell apart.
  const CONCURRENCY = 5;
  let succeeded = 0;
  let refused = 0;
  const badErrors: string[] = [];
  let running = true;
  const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

  function fire() {
    if (!running) return;
    const req = http.request(
      { host: '127.0.0.1', port, path: '/users', agent },
      (res) => {
        res.resume();
        res.on('end', () => {
          succeeded++;
          fire();
        });
      }
    );
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        refused++;
      } else {
        badErrors.push(err.code ?? err.message);
      }
      fire();
    });
    req.end();
  }
  for (let i = 0; i < CONCURRENCY; i++) fire();

  const sigtermAt = Date.now() + SHUTDOWN_SIGTERM_AT_SEC * 1000;
  setTimeout(() => {
    console.log(`  sending SIGTERM (server has been up ${SHUTDOWN_SIGTERM_AT_SEC}s)...`);
    child.kill('SIGTERM');
  }, SHUTDOWN_SIGTERM_AT_SEC * 1000);

  const exitedAt = await Promise.race([
    exited,
    new Promise<number>((resolve) => setTimeout(() => resolve(-1), DRAIN_TIMEOUT_MS)),
  ]);

  // Give the post-exit refusal wave a brief moment to register, then stop.
  await new Promise((r) => setTimeout(r, 200));
  running = false;
  agent.destroy();

  if (exitedAt === -1) {
    console.log(`  ✗ process did not exit within ${DRAIN_TIMEOUT_MS}ms of SIGTERM — shutdown hung.`);
    child.kill('SIGKILL');
    return false;
  }
  const drainMs = exitedAt - sigtermAt;
  console.log(`  drained and exited ${Math.max(0, drainMs)}ms after SIGTERM.`);
  console.log(
    `  ${succeeded} requests succeeded, ${refused} cleanly refused after shutdown began (expected), ${badErrors.length} unexpected errors${
      badErrors.length ? ` (${[...new Set(badErrors)].join(', ')})` : ''
    }.`
  );
  // A handful of ECONNRESET right at the close() boundary is a normal TCP-
  // teardown race (the socket gets assigned one more request the same tick
  // close() starts tearing it down) present in effectively any graceful-
  // shutdown implementation, not a sign requests are being dropped in bulk.
  // Demanding literal zero would flag on OS-level jitter alone; the real
  // signal is whether it stays a rounding error, not a meaningful fraction.
  const resetRatio = succeeded > 0 ? badErrors.length / succeeded : badErrors.length > 0 ? 1 : 0;
  const clean = resetRatio < RESET_RATIO_WARN_THRESHOLD;
  console.log(
    clean
      ? '  ✓ in-flight requests completed (at most a negligible teardown-race rate); new connections were cleanly refused, not dropped.'
      : `  ⚠ ${(resetRatio * 100).toFixed(3)}% reset/dropped rate around the SIGTERM (threshold ${(
          RESET_RATIO_WARN_THRESHOLD * 100
        ).toFixed(2)}%) — in-flight requests may not be draining cleanly.`
  );
  return clean || !STRICT;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function main() {
  console.log('HeliosJS soak test (not a comparative benchmark — Helios only)');
  console.log(
    `SOAK_DURATION=${DURATION_SEC}s SOAK_CONNECTIONS=${CONNECTIONS} SOAK_STRICT=${STRICT ? '1' : '0'}`
  );

  const ok1 = await phase1MemoryStability(4400);
  const ok2 = await phase2ShutdownUnderLoad(4401);

  console.log('\n' + '─'.repeat(60));
  console.log(ok1 && ok2 ? 'Soak test passed.' : 'Soak test found issues (see ⚠/✗ above).');
  if (!(ok1 && ok2)) process.exitCode = 1;
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
