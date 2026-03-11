import { Controller } from 'quantum-flow/core';
import { Port, Server } from 'quantum-flow/http';
import { Catch, Cors, Use } from 'quantum-flow/middlewares';
import { Socket } from './controllers/socket';
import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User, Socket],
  middlewares: [function Global(req, res, next) {}],
})
@Cors({ origin: '*' })
@Use(function Global1(req, res, next) {
  return next();
})
@Catch(function GLOBALCATCH(err) {
  return { status: 400 };
})
export class Root {}

@Server({
  controllers: [Root],
  websocket: { enabled: true, path: '/ws' },
  interceptor: (data) => data,
  errorHandler: (err) => err,
  cors: { origin: '*' },
  middlewares: [() => {}, () => {}],
})
@Port(3000)
@Use(() => {})
@Use([() => {}, () => {}])
@Catch((err) => err)
export class App {}
