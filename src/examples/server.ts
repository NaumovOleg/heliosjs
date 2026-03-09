import { Catch, Controller, Intercept } from 'quantum-flow/core';
import { Host, HttpServer, Port, Server, Use } from 'quantum-flow/http';
import 'reflect-metadata';

import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User],
  interceptor: (resp: any) => {
    console.log('APP INTERCEPTOR');
    return resp;
  },
})
class Root {}

@Server({
  controllers: [Root],
  websocket: {
    enabled: true,
  },
})
@Port(3000)
@Host('localhost')
@Use((res: any) => res)
@Intercept((data: any, req, res) => {
  return data;
})
@Catch((r: any) => {
  return r;
})
class App {}

const server = new HttpServer(App);

server.listen().catch(console.error);
