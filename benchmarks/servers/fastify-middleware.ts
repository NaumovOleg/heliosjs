import Fastify from 'fastify';

// Dedicated server for the middleware-pipeline suite — see
// helios-middleware.ts's comment for why this isn't just added to
// fastify.ts's existing routes (less of a concern for Fastify's radix-tree
// router specifically, but kept consistent with the other three servers).
const app = Fastify();

const noopHook = async (request: { headers: Record<string, unknown> }) => {
  void request.headers['x-bench'];
};
const payload = async () => ({ users: ['alice', 'bob', 'charlie'] });
app.get('/mw/0', payload);
app.get('/mw/3', { preHandler: [noopHook, noopHook, noopHook] }, payload);
app.get('/mw/6', { preHandler: [noopHook, noopHook, noopHook, noopHook, noopHook, noopHook] }, payload);

await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
process.send?.('ready');
