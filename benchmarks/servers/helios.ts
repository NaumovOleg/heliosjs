import 'reflect-metadata';
import { Controller, Get, Post } from '@heliosjs/core';
import { Helios, Server } from '@heliosjs/http';

@Controller('/users')
class UsersController {
  @Get('/')
  list() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @Get('/:id')
  getOne() {
    return { id: '42', name: 'widget', price: 9.99 };
  }
  @Post('/')
  create() {
    return { created: true };
  }
}

@Controller('/health')
class HealthController {
  @Get('/')
  check() {
    return { status: 'ok' };
  }
}

@Server({
  port: Number(process.env.PORT),
  controllers: [UsersController, HealthController],
  log: false,
})
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
