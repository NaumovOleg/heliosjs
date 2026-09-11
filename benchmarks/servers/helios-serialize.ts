import 'reflect-metadata';
import { Controller, Get } from '@heliosjs/core';
import { Helios, Server } from '@heliosjs/http';
import { LARGE_PAYLOAD, MEDIUM_PAYLOAD, SMALL_PAYLOAD } from '../lib/serialize-fixtures.js';

// Plain `JSON.stringify` (see Res.end() in utils/core/response.ts) — Helios
// has no schema-compiled fast path to enable, same as Express/NestJS.
@Controller('/serialize')
class SerializeController {
  @Get('/small')
  small() {
    return SMALL_PAYLOAD;
  }
  @Get('/medium')
  medium() {
    return MEDIUM_PAYLOAD;
  }
  @Get('/large')
  large() {
    return LARGE_PAYLOAD;
  }
}

@Server({ port: Number(process.env.PORT), controllers: [SerializeController], log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
