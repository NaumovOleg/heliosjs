// Shared DTO for the validation suite (run-validation.ts) — used verbatim by
// helios-validate.ts, express-validate.ts, and nestjs-validate.ts so the
// *library* (class-validator/class-transformer) and *rules* stay identical
// across those three; only framework integration differs, which is the
// thing this suite exists to measure. Fastify validates against its own
// native JSON Schema instead (fastify-validate.ts, see its own comment) —
// there's no shared class to reuse there, only the same field shapes/rules
// re-expressed as schema.
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString()
  @MinLength(2)
  street!: string;

  @IsString()
  @MinLength(2)
  city!: string;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  quantity!: number;

  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses!: AddressDto[];
}

/** One fixed, valid payload — every framework's benchmark POSTs this. */
export const VALID_ORDER_PAYLOAD = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  quantity: 3,
  active: true,
  note: 'Leave at the front desk',
  addresses: [
    { street: '123 Main St', city: 'Springfield' },
    { street: '456 Oak Ave', city: 'Shelbyville' },
  ],
};
