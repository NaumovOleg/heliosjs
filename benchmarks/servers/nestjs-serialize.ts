import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LARGE_PAYLOAD, MEDIUM_PAYLOAD, SMALL_PAYLOAD } from '../lib/serialize-fixtures.js';

// Plain JSON.stringify under the Express adapter (Nest's default), no
// schema-compiled fast path.
@Controller('serialize')
class SerializeController {
  @Get('small')
  small() {
    return SMALL_PAYLOAD;
  }
  @Get('medium')
  medium() {
    return MEDIUM_PAYLOAD;
  }
  @Get('large')
  large() {
    return LARGE_PAYLOAD;
  }
}

@Module({ controllers: [SerializeController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(Number(process.env.PORT), '127.0.0.1');
process.send?.('ready');
