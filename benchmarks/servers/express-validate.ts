import 'reflect-metadata'; // class-transformer's @Type() needs Reflect.getMetadata
import express from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from '../lib/validate-dto.js';

// Express has no built-in validation convention — class-validator invoked
// manually is the closest fair baseline: same library/rules as
// helios-validate.ts and nestjs-validate.ts, no framework-level integration
// to speed it up (that absence of integration is itself part of what's
// being measured, not an oversight).
const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.post('/validate', async (req, res) => {
  const dto = plainToInstance(CreateOrderDto, req.body);
  const errors = await validate(dto);
  if (errors.length > 0) {
    res.status(400).json({ errors: errors.map((e) => e.toString()) });
    return;
  }
  res.json(dto);
});

app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  process.send?.('ready');
});
