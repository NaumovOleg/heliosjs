import { Controller } from 'quantum-flow/core';
import { Server } from 'quantum-flow/http';
import { Catch } from 'quantum-flow/middlewares';
import { Socket } from './controllers/socket';
import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User, Socket],
  middlewares: [function Global(req, res, next) {}],
})
export class Root {}

@Server({
  controllers: [Root],
})
@Catch(function mmmmmm(err) {
  return err;
})
export class App {}
