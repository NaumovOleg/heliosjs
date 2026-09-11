import 'reflect-metadata';
import { Body, Controller, Post } from '@heliosjs/core';
import { compileSchema } from '@heliosjs/core/utils';
import { Helios, Server } from '@heliosjs/http';

// Same field shapes/rules as lib/validate-dto.ts's CreateOrderDto and
// fastify-validate.ts's orderSchema, re-expressed as JSON Schema — measures
// Helios's compileSchema() (Ajv) path against the class-validator path
// (helios-validate.ts) and against Fastify's native schema validation.
// Email uses `pattern` rather than `format` for the same reason
// fastify-validate.ts does: skip ajv-formats as a dependency for one check.
const addressSchema = {
  type: 'object',
  required: ['street', 'city'],
  properties: {
    street: { type: 'string', minLength: 2 },
    city: { type: 'string', minLength: 2 },
  },
};

const OrderSchema = compileSchema({
  type: 'object',
  required: ['name', 'email', 'quantity', 'active', 'addresses'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    email: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    quantity: { type: 'integer', minimum: 0, maximum: 1000 },
    active: { type: 'boolean' },
    note: { type: 'string' },
    addresses: { type: 'array', items: addressSchema },
  },
});

@Controller('/validate')
class ValidateController {
  @Post('/')
  create(@Body(OrderSchema) dto: unknown) {
    return dto;
  }
}

@Server({ port: Number(process.env.PORT), controllers: [ValidateController], log: false })
class BenchApp {}

const app = new Helios(BenchApp);
await app.listen(undefined, '127.0.0.1');
process.send?.('ready');
