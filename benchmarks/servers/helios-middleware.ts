import 'reflect-metadata';
import { Controller, Get } from '@heliosjs/core';
import type { MiddlewareCB } from '@heliosjs/core/types';
import { Helios, Server } from '@heliosjs/http';
import { Use } from '@heliosjs/middlewares';

// Dedicated server for the middleware-pipeline suite (run-middleware.ts) —
// deliberately its own file/process rather than added to helios.ts's
// existing routes. Tried that first: findRoute walks controllers/routes in
// registration order and only skips a candidate once a same-or-better
// specificity match already exists (see match.ts), so whichever controller
// isn't checked first pays for every earlier controller's failed regex
// tests. Reordering to put the new controller first "fixed" /mw/0 but
// silently degraded /users' own already-published baseline (run.ts) by the
// same amount — moved the cost, didn't remove it. A single-concern server
// with nothing to compete with gives /mw/0 a genuinely clean baseline
// without touching the routing suite's numbers. (The route-table-position
// cost itself is real and worth knowing about — noted in
// BENCHMARK-SUITE-PLAN.md — just not what this suite exists to measure.)
//
// Trivial, identical no-op — reads one header, does no I/O. Mirrored
// literally (same operation) in the other three *-middleware.ts servers so
// this measures each framework's per-layer dispatch cost, not different
// amounts of work.
const noopMw: MiddlewareCB = (req, _res, next) => {
  void req.headers['x-bench'];
  next();
};

@Controller('/mw')
class MiddlewareController {
  @Get('/0')
  zero() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @Use([noopMw, noopMw, noopMw])
  @Get('/3')
  three() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @Use([noopMw, noopMw, noopMw, noopMw, noopMw, noopMw])
  @Get('/6')
  six() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
}

@Server({ port: Number(process.env.PORT), controllers: [MiddlewareController], log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
