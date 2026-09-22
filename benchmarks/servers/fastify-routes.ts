import Fastify from 'fastify';

// Same 300-route table as helios-routes.ts (10 x [25 static, 4 param, 1 trailing
// wildcard] under /api/c0../c9) — Fastify is the radix-tree reference point for
// the routing-scale suite (run-routes.ts), not a full framework comparison
// (Express/NestJS are deliberately skipped there).
const app = Fastify();
const payload = async () => ({ ok: true });

for (let n = 0; n < 10; n++) {
  for (let s = 0; s < 25; s++) app.get(`/api/c${n}/s${s}`, payload);
  for (let p = 0; p < 4; p++) app.get(`/api/c${n}/p${p}/:id`, payload);
  app.get(`/api/c${n}/w/*`, payload);
}

await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
process.send?.('ready');
