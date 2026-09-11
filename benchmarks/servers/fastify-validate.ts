import Fastify from 'fastify';

// Fastify's idiomatic validation path: a declared JSON Schema, compiled by
// its built-in Ajv instance — expected to be structurally faster than the
// class-validator path the other three servers use (same framing as the
// routing suite's Fastify-wins-on-serialization note: this is Fastify's
// real advantage, not an unfair setup). Field shapes/rules mirror
// lib/validate-dto.ts's CreateOrderDto as closely as JSON Schema allows —
// email uses a `pattern` rather than the `format` keyword so this doesn't
// need the `ajv-formats` plugin as a new dependency for one check.
const addressSchema = {
  type: 'object',
  required: ['street', 'city'],
  properties: {
    street: { type: 'string', minLength: 2 },
    city: { type: 'string', minLength: 2 },
  },
};

const orderSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'quantity', 'active', 'addresses'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      quantity: { type: 'integer', minimum: 0, maximum: 1000 },
      active: { type: 'boolean' },
      note: { type: 'string' },
      addresses: { type: 'array', items: addressSchema },
    },
  },
};

const app = Fastify();
app.post('/validate', { schema: orderSchema }, async (request) => request.body);

await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
process.send?.('ready');
