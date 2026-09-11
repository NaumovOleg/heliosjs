import Fastify from 'fastify';

const app = Fastify();
app.get('/users', async () => ({ users: ['alice', 'bob', 'charlie'] }));
app.get('/users/:id', async () => ({ id: '42', name: 'widget', price: 9.99 }));
app.post('/users', async () => ({ created: true }));
app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
process.send?.('ready');
