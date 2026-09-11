import express from 'express';

const app = express();
app.disable('x-powered-by');
app.get('/users', (_req, res) => res.json({ users: ['alice', 'bob', 'charlie'] }));
app.get('/users/:id', (_req, res) => res.json({ id: '42', name: 'widget', price: 9.99 }));
app.post('/users', (_req, res) => res.json({ created: true }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  process.send?.('ready');
});
