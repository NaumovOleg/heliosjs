import express from 'express';
import { LARGE_PAYLOAD, MEDIUM_PAYLOAD, SMALL_PAYLOAD } from '../lib/serialize-fixtures.js';

// Plain `res.json()` -> JSON.stringify, no schema-compiled fast path.
const app = express();
app.disable('x-powered-by');
app.get('/serialize/small', (_req, res) => res.json(SMALL_PAYLOAD));
app.get('/serialize/medium', (_req, res) => res.json(MEDIUM_PAYLOAD));
app.get('/serialize/large', (_req, res) => res.json(LARGE_PAYLOAD));

app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  process.send?.('ready');
});
