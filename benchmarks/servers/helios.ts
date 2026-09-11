import 'reflect-metadata';
import { Controller, Get, Post } from '@heliosjs/core';
import { Helios, Server } from '@heliosjs/http';

@Controller('/users')
class UsersController {
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
class HealthController {
  @Get('/')
  check() {
    return { status: 'ok' };
  }
}

@Server({
  port: Number(process.env.PORT),
  controllers: [UsersController, HealthController],
  log: false,
})
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');

// Opt-in only (`benchmarks/soak.ts` sets this) — reports memory/event-loop
// stats back to the parent over IPC every 5s. Zero cost for every other
// suite, which never sets the env var.
if (process.env.SOAK_REPORT_STATS) {
  const { monitorEventLoopDelay } = await import('node:perf_hooks');
  // Default resolution (10ms) makes an idle loop's `.mean` read ~10ms flat —
  // that's the sampling interval acting as a floor, not real lag. A finer
  // resolution keeps that floor small enough that genuine congestion still
  // shows up as a clear jump above baseline instead of being lost in it.
  const delay = monitorEventLoopDelay({ resolution: 1 });
  delay.enable();
  setInterval(() => {
    const mem = process.memoryUsage();
    process.send?.({
      type: 'stats',
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      eventLoopLagMs: delay.mean / 1e6,
    });
    delay.reset();
  }, 5000).unref();
}
