import express from 'express';

// Dedicated server for the middleware-pipeline suite — see
// helios-middleware.ts's comment for why this isn't just added to
// express.ts's existing routes.
const app = express();
app.disable('x-powered-by');

const noopMw = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  void req.headers['x-bench'];
  next();
};
const send = (_req: express.Request, res: express.Response) =>
  res.json({ users: ['alice', 'bob', 'charlie'] });
app.get('/mw/0', send);
app.get('/mw/3', noopMw, noopMw, noopMw, send);
app.get('/mw/6', noopMw, noopMw, noopMw, noopMw, noopMw, noopMw, send);

app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  process.send?.('ready');
});
