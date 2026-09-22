import 'reflect-metadata';
import { Controller, Get } from '@heliosjs/core';
import type { ControllerClass } from '@heliosjs/core/types';
import { Helios, Server } from '@heliosjs/http';

// Dedicated server for the routing-scale suite (run-routes.ts): 10 controllers x
// 30 routes (25 static, 4 param, 1 trailing wildcard) under /api/c0../c9, 300
// routes total, built programmatically rather than hand-written. Same isolation
// reasoning as helios-middleware.ts: this suite exists specifically to measure
// route *position* cost (pre-trie, findRoute scans routes/controllers in
// declaration order — see match.ts and CONCERNS.md), so it needs its own
// process with nothing else competing on the table.
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

const controllers = Array.from({ length: 10 }, (_, n) => buildController(n));

@Server({ port: Number(process.env.PORT), controllers, log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
