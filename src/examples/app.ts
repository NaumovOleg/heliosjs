import * as Joi from 'joi';
import { Controller } from 'quantum-flow/core';
import { Port, Server } from 'quantum-flow/http';
import { Catch, Cors, Sanitize, Use } from 'quantum-flow/middlewares';
import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User],
  middlewares: [function Global(req, res, next) {}],
})
@Cors({ origin: '*' })
@Use(function Global1(req, res, next) {
  return next();
})
@Catch(function GLOBALCATCH(err) {
  return { status: 400 };
})
@Sanitize({
  schema: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
  }),
  action: 'both',
  options: { abortEarly: false },
  stripUnknown: true,
  type: 'body',
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
@Sanitize({
  schema: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
  }),
  action: 'both',
  options: { abortEarly: false },
  stripUnknown: true,
  type: 'headers',
})
export class App {}
