import 'reflect-metadata';
import { Controller, Get } from '@heliosjs/core';
import type { ControllerClass } from '@heliosjs/core/types';
import { Helios, Server } from '@heliosjs/http';

// Dedicated server for the routing-scale suite (run-routes.ts): 10 controllers x
// 30 routes (25 static, 4 param, 1 trailing wildcard) under /api/c0../c9, 300
// routes total, built programmatically rather than hand-written. Same isolation
// reasoning as helios-middleware.ts: this suite exists specifically to measure
// route *position* cost within findRoute's controller/route tree (see match.ts
// and CONCERNS.md), so it needs its own process with nothing else competing.
//
// The 10 controllers are nested as children of one root controller, not passed
// as 10 separate entries to @Server. That distinction matters a lot here:
// Helios.runController loops over *root* controllers too (this.rootControllers
// in Helios.ts), trying each in turn until one matches — a second, unrelated
// linear scan. 10 separate @Server controllers would make every request to c9
// pay for 9 failed whole-controller lookups on top of whatever findRoute costs
// within each one, swamping the very thing this suite exists to isolate (an
// earlier version of this file did exactly that, and the trie showed ~0
// measured benefit as a result — the root-controller scan was the actual
// bottleneck, not route position within a controller). Nesting under one
// parent puts all 300 routes in a single ControllerMeta tree, which is also
// the shape findRoute actually deals with (a controller's own routes plus its
// `children`, recursively) and the realistic one for an app this size.
function buildController(n: number): ControllerClass {
  class RouteGroup {}
  const routes: { name: string; path: string }[] = [];
  for (let s = 0; s < 25; s++) routes.push({ name: `s${s}`, path: `/s${s}` });
  for (let p = 0; p < 4; p++) routes.push({ name: `p${p}`, path: `/p${p}/:id` });
  routes.push({ name: 'w', path: '/w/*' });

  for (const r of routes) {
    const descriptor: PropertyDescriptor = {
      value: function handler() {
        return { ok: true };
      },
      writable: true,
      enumerable: true,
      configurable: true,
    };
    Object.defineProperty(RouteGroup.prototype, r.name, descriptor);
    Get(r.path)(RouteGroup.prototype, r.name, descriptor);
  }

  return Controller(`/api/c${n}`)(RouteGroup) as ControllerClass;
}

const children = Array.from({ length: 10 }, (_, n) => buildController(n));

@Controller({ prefix: '/', controllers: children })
class ApiRoot {}

@Server({ port: Number(process.env.PORT), controllers: [ApiRoot], log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
