import Fastify from 'fastify';
import { ITEM_SCHEMA, LARGE_PAYLOAD, MEDIUM_PAYLOAD, SMALL_PAYLOAD } from '../lib/serialize-fixtures.js';

// Fastify's idiomatic serialization path: a declared response schema, which
// Fastify compiles into a `fast-json-stringify` serializer instead of
// generic `JSON.stringify` — its real structural advantage, deliberately
// exercised here (the routing suite's own docs note it doesn't enable this,
// on purpose, elsewhere — this suite exists specifically to measure it).
// Response *validation* schemas use Ajv; response *serialization* uses
// fast-json-stringify — different mechanism, worth not conflating in the
// results table's labeling.
const arraySchema = { type: 'array', items: ITEM_SCHEMA };

const app = Fastify();
app.get('/serialize/small', { schema: { response: { 200: ITEM_SCHEMA } } }, async () => SMALL_PAYLOAD);
app.get(
  '/serialize/medium',
  { schema: { response: { 200: arraySchema } } },
  async () => MEDIUM_PAYLOAD
);
app.get(
  '/serialize/large',
  { schema: { response: { 200: arraySchema } } },
  async () => LARGE_PAYLOAD
);

await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
process.send?.('ready');
