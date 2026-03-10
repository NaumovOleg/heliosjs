import { Catch, Controller, Use } from 'quantum-flow/core';
import { HttpServer, Port, Server } from 'quantum-flow/http';
import 'reflect-metadata';

import { User } from './controllers/user';

@Controller({ prefix: 'api', controllers: [User] })
class Root {}

@Server({
  controllers: [Root],
  websocket: { enabled: true },
  interceptor: (data) => data,
  errorHandler: (err) => err,
})
@Port(3000)
@Use((data) => data)
@Use((data) => data)
@Catch((err) => err)
class App {}

const server = new HttpServer(App);

server.listen().catch(console.error);
