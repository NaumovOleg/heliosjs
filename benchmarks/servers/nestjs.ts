import 'reflect-metadata';
import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('users')
class UsersController {
  @Get()
  list() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @Get(':id')
  getOne() {
    return { id: '42', name: 'widget', price: 9.99 };
  }
  @Post()
  create() {
    return { created: true };
  }
}

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [UsersController, HealthController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(Number(process.env.PORT), '127.0.0.1');
process.send?.('ready');
