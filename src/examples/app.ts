import { ANY, Controller, Response } from '@heliosjs/core';
import { Server } from '@heliosjs/http';
import path from 'path';

import { UserResolver, pubSub } from './controllers/resolver';
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
  statics: [{ path: path.join(__dirname, '../../'), options: { index: 'index.html' } }],
  // websocket: { path: '/ws' },
  graphql: { path: '/graphql', resolvers: [UserResolver], pubSub },

  sse: { enabled: true },
})
export class App {}
