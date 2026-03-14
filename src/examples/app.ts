import path from 'path';
import { ANY, Controller, Response } from 'quantum-flow/core';
import { Server } from 'quantum-flow/http';

import { Socket } from './controllers/socket';
import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User, Socket],
  middlewares: [function Global(req, res, next) {}],
})
export class Root {
  @ANY()
  use() {
    return 'default';
  }
}

@Controller({ prefix: 'metric', controllers: [] })
export class MetricsController {
  @ANY()
  async any(@Response() resp: any) {}
}

@Server({
  controllers: [Root, Socket, MetricsController],
  statics: [
    {
      path: path.join(__dirname, '../../'),
      options: { index: 'index.html' },
    },
  ],
  sse: { enabled: true },
})
export class App {}
