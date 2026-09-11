import 'reflect-metadata';
import { Body, Controller, Post } from '@heliosjs/core';
import { Helios, Server } from '@heliosjs/http';
import { CreateOrderDto } from '../lib/validate-dto.js';

// Helios validates automatically off @Body(Dto) — no separate pipe/decorator
// to wire up (see utils/core/validate.ts: plainToInstance + class-validator's
// validate(), triggered by any TO_VALIDATE param type). This is the whole
// integration surface being measured here.
@Controller('/validate')
class ValidateController {
  @Post('/')
  create(@Body(CreateOrderDto) dto: CreateOrderDto) {
    return dto;
  }
}

@Server({ port: Number(process.env.PORT), controllers: [ValidateController], log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
