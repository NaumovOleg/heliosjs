import 'reflect-metadata';
import http from 'node:http';
import { Helios, Server } from '@heliosjs/http';

/**
 * Boot a real Helios HTTP app on an OS-assigned free port (`:0`) and return its
 * base URL plus a `close` that actually shuts the socket down.
 *
 * Why not `app.listen()` / `app.close()`: `listen(0)` is coerced to port 3000
 * (`port || config.port || 3000`), and `close()` no-ops unless `isRunning` was
 * set by `listen()`. Driving the raw `http.Server` sidesteps both.
 */
export interface E2EApp {
  app: Helios;
  base: string;
  close: () => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startE2E(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverConfig: Record<string, any> = {}
): Promise<E2EApp> {
  @Server({ controllers, ...serverConfig })
  class App {}

  const app = new Helios(App as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (app as any).app as http.Server;

  await new Promise<void>((resolve) => raw.listen(0, '127.0.0.1', () => resolve()));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const port = (raw.address() as any).port as number;

  return {
    app,
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        raw.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
