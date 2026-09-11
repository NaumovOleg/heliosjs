import 'reflect-metadata';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CreateOrderDto } from '../lib/validate-dto.js';

// `ValidationPipe({ transform: true })` is Nest's idiomatic validation path —
// transform: true matches Helios's always-transforms behavior (see
// utils/core/validate.ts's plainToInstance call), same class-validator rules
// as helios-validate.ts/express-validate.ts via the shared DTO.
@Controller('validate')
class ValidateController {
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return dto;
  }
}

@Module({ controllers: [ValidateController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
app.useGlobalPipes(new ValidationPipe({ transform: true }));
await app.listen(Number(process.env.PORT), '127.0.0.1');
process.send?.('ready');
