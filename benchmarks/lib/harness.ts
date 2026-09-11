// Shared pieces of the benchmark harness — process-isolated server
// start/stop, an autocannon runner, median-of-N, and a CSV appender. Used by
// `run.ts` (the routing suite) and by `soak.ts` (the long-run stability
// suite); new suites should build on this instead of copy-pasting it again.
import type { ChildProcess } from 'node:child_process';
import { execSync, fork } from 'node:child_process';
import fs from 'node:fs';
import autocannon from 'autocannon';

const READY_TIMEOUT = 10_000;

export interface BenchResult {
  requests: { average: number };
  latency: { average: number; p99: number };
  throughput: { average: number };
}

/**
 * Forks a compiled benchmark server file and waits for it to signal
 * readiness via `process.send('ready')` (every file under `benchmarks/servers/`
 * does this once `listen()` resolves).
 */
export function startServer(
  serverFilePath: string,
  port: number,
  extraEnv: NodeJS.ProcessEnv = {}
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = fork(serverFilePath, {
      env: { ...process.env, PORT: String(port), ...extraEnv },
      silent: true,
    });
    child.stderr?.pipe(process.stderr);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${serverFilePath} did not signal ready within ${READY_TIMEOUT}ms`));
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
        reject(new Error(`${serverFilePath} exited with code ${code}`));
      }
    });
  });
}

export function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
}

export function runAutocannon(
  url: string,
  duration: number,
  connections: number,
  extra: Partial<Pick<autocannon.Options, 'method' | 'headers' | 'body'>> = {}
): Promise<BenchResult> {
  return new Promise((resolve, reject) => {
    autocannon(
      { url, connections, duration, ...extra },
      (err: Error | null, result: BenchResult) => (err ? reject(err) : resolve(result))
    );
  });
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Short commit hash of `cwd`'s repo, or `'unknown'` outside a git checkout. */
export function getCommit(cwd: string): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export function csvField(value: unknown): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Appends `rows` to `file`, writing `header` first if the file is new. */
export function appendCsvRows(file: string, header: string, rows: string[]): void {
  const isNew = !fs.existsSync(file);
  if (isNew) fs.writeFileSync(file, header + '\n');
  fs.appendFileSync(file, rows.join('\n') + '\n');
}
