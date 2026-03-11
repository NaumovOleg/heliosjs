import { Catch, Controller, CORS, Use } from 'quantum-flow/core';
import { Port, Server } from 'quantum-flow/http';
import 'reflect-metadata';

import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User],
  middlewares: [function Global(req, res, next) {}],
})
@CORS({ origin: '*' })
@Use(function Global1(req, res, next) {
  return next();
})
@Catch(function GLOBALCATCH(err) {
  return { status: 400 };
})
export class Root {}

@Server({
  controllers: [Root],
  websocket: { enabled: true },
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
