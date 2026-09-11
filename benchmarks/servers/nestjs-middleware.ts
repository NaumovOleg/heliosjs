import 'reflect-metadata';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

// Dedicated server for the middleware-pipeline suite — see
// helios-middleware.ts's comment for why this isn't just added to
// nestjs.ts's existing routes. `@UseGuards` is the decorator-based,
// NestJS-idiomatic way to stack cross-cutting checks ahead of a handler
// (closest equivalent to Helios's @Use / Express's middleware array /
// Fastify's preHandler chain), not raw Express middleware underneath —
// matches how real Nest apps actually do this.
@Injectable()
class NoopGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    void req.headers['x-bench'];
    return true;
  }
}

@Controller('mw')
class MiddlewareController {
  @Get('0')
  zero() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @UseGuards(NoopGuard, NoopGuard, NoopGuard)
  @Get('3')
  three() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
  @UseGuards(NoopGuard, NoopGuard, NoopGuard, NoopGuard, NoopGuard, NoopGuard)
  @Get('6')
  six() {
    return { users: ['alice', 'bob', 'charlie'] };
  }
}

@Module({ controllers: [MiddlewareController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(Number(process.env.PORT), '127.0.0.1');
process.send?.('ready');
