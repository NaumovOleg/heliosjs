---
sidebar_position: 5
---

# Validation with DTOs and class-validator

HeliosJS validates request data using DTO classes with `class-validator` decorators. Validation runs automatically before your handler executes.

Prefer a JSON Schema and raw throughput over decorated classes? See [Fast path: JSON Schema with compileSchema](#fast-path-json-schema-with-compileschema) further down — same `@Body`/`@Params`/etc., a different validator underneath.

## Installation

`class-validator` and `class-transformer` are optional peer dependencies — install them yourself:

```bash
npm install class-validator class-transformer
```

Without them, the first `@Body(SomeDtoClass)` (or `@Params`/`@QueryParam`/…) call throws a clear error naming the missing package, instead of a cryptic module-not-found.

## Basic Validation

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { IsString, IsEmail, MinLength, IsOptional, IsNumber } from "class-validator";

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsNumber()
  age?: number;
}

@Controller("/users")
export class UserController {
  @Post("/")
  create(@Body(CreateUserDto) data: CreateUserDto) {
    // data is validated and transformed before reaching here
    return { id: 1, ...data };
  }
}
```

Request with invalid data:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "A", "email": "not-an-email"}'
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "status": 400,
    "message": "Validation failed",
    "details": [
      { "field": "name", "constraint": "name must be longer than or equal to 2 characters" },
      { "field": "email", "constraint": "email must be an email" }
    ]
  }
}
```

## Validation Options

Pass `ValidatorOptions` as the second argument to `@Body`:

```typescript
import { ValidationOptions } from "class-validator";

const strictOptions: ValidationOptions = {
  forbidNonWhitelisted: true,  // Reject unknown properties
  whitelist: true,              // Strip unknown properties
  stopAtFirstError: false,      // Return all errors
};

const permissiveOptions: ValidationOptions = {
  whitelist: true,
  stopAtFirstError: true,       // Return first error only
};

@Controller("/users")
export class UserController {
  @Post("/strict")
  createStrict(@Body(CreateUserDto, strictOptions) data: CreateUserDto) {
    return data;
  }

  @Post("/permissive")
  createPermissive(@Body(CreateUserDto, permissiveOptions) data: CreateUserDto) {
    return data;
  }
}
```

## Validating Query Parameters

Use `@QueryParam` with a DTO class:

```typescript
import { Controller, Get, QueryParam } from "@heliosjs/core";
import { IsOptional, IsInt, Min, Max } from "class-validator";

class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller("/users")
export class UserController {
  @Get("/")
  findAll(@QueryParam(PaginationDto) query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    return { page, limit, data: [] };
  }
}
```

## Validating Route Parameters

```typescript
import { Controller, Get, Params } from "@heliosjs/core";
import { IsString, Matches } from "class-validator";

class MongoIdDto {
  @IsString()
  @Matches(/^[0-9a-fA-F]{24}$/)
  id!: string;
}

@Controller("/users")
export class UserController {
  @Get("/:id")
  findOne(@Params(MongoIdDto) params: MongoIdDto) {
    return { id: params.id };
  }
}
```

## Validating Headers

```typescript
import { Controller, Get, Headers } from "@heliosjs/core";
import { IsString, Matches } from "class-validator";

class AuthHeaderDto {
  @IsString()
  @Matches(/^Bearer .+$/)
  authorization!: string;
}

@Controller("/profile")
export class ProfileController {
  @Get("/")
  getProfile(@Headers(AuthHeaderDto) headers: AuthHeaderDto) {
    const token = headers.authorization.replace("Bearer ", "");
    return { token };
  }
}
```

## Custom Validation Decorators

Create reusable validation rules:

```typescript
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ async: false })
class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string) {
    // Check against database (sync example)
    const existingUsers = ["admin@example.com", "test@example.com"];
    return !existingUsers.includes(email.toLowerCase());
  }

  defaultMessage() {
    return "Email already exists";
  }
}

function IsUniqueEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUniqueEmailConstraint,
    });
  };
}

class CreateUserDto {
  @IsUniqueEmail({ message: "This email is already registered" })
  email!: string;

  @IsString()
  name!: string;
}
```

## DTO with Static from() Factory

DTOs can implement a static `from()` method for custom transformation:

```typescript
import { IsString, IsNumber } from "class-validator";

class CreateOrderDto {
  @IsString()
  product!: string;

  @IsNumber()
  quantity!: number;

  static from(raw: any): CreateOrderDto {
    const dto = new CreateOrderDto();
    dto.product = String(raw.product || "").trim();
    dto.quantity = Math.max(1, Number(raw.quantity) || 1);
    return dto;
  }
}

@Controller("/orders")
export class OrderController {
  @Post("/")
  create(@Body(CreateOrderDto) data: CreateOrderDto) {
    return { id: 1, ...data };
  }
}
```

## Fast path: JSON Schema with compileSchema

`class-validator` + `class-transformer` re-run reflection on every request.
For a hot route, `compileSchema()` builds a fast Ajv validator function from a
plain JSON Schema, compiled once on the first request and reused after that,
wrapped as the same `from()` shape the framework already checks for above —
so it plugs into `@Body`, `@Params`, `@QueryParam`, `@Headers`, `@Cookies`,
`@Files` with no other change. In the [validation
benchmark](../benchmarks-validation), this is the difference between ~41k and
~68k req/s on the same route, on par with Fastify's own native schema
validation.

`ajv` is an optional peer dependency — `npm install ajv`. Without it, the
first request through a `compileSchema()`'d route throws a clear error naming
the missing package.

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { compileSchema } from "@heliosjs/core/utils";

// Declare once, at module scope — the schema compiles lazily on first use,
// not per request.
const CreateOrderSchema = compileSchema<{ product: string; quantity: number }>({
  type: "object",
  required: ["product", "quantity"],
  properties: {
    product: { type: "string", minLength: 2 },
    quantity: { type: "integer", minimum: 1, maximum: 1000 },
  },
});

@Controller("/orders")
export class OrderController {
  @Post("/")
  create(@Body(CreateOrderSchema) data: { product: string; quantity: number }) {
    // data matched the schema (and was type-coerced, e.g. "3" -> 3)
    return { id: 1, ...data };
  }
}
```

A failed check throws the same `ValidationError` (HTTP 400) as the
class-validator path, with one `details` entry per Ajv error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "status": 400,
    "message": "Validation failed",
    "details": [
      { "field": "product", "constraint": "must NOT have fewer than 2 characters" }
    ]
  }
}
```

Trade-offs versus a DTO class:

- No `class-transformer` instance — `data` comes back as a plain object matching the schema, not a class instance.
- No nested `@ValidateNested` nesting or custom `@ValidatorConstraint` decorators — express nested shapes as nested JSON Schema (`type: 'array', items: {...}`) instead.
- One shared Ajv instance for the whole process (`allErrors`, `coerceTypes`, and `useDefaults` on) — there's no per-schema options argument; if you need a schema-specific Ajv option, that's a small addition to `compileSchema` itself, not something to work around.

Use `@Body(DtoClass)` for everyday routes — the decorator-based DX is worth the reflection cost there. Reach for `compileSchema()` on the routes that actually show up hot in a profiler.

## Complete Example: User Registration

```typescript
import {
  Controller,
  Post,
  Body,
  DuplicateEntryError,
} from "@heliosjs/core";
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from "class-validator";

class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z\s-]+$/, { message: "Name can only contain letters, spaces, and hyphens" })
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Password must contain uppercase, lowercase, and a number",
  })
  password!: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

let registeredEmails: string[] = [];

@Controller("/auth")
export class AuthController {
  @Post("/register")
  register(@Body(RegisterDto) data: RegisterDto) {
    if (registeredEmails.includes(data.email)) {
      throw new DuplicateEntryError("Email already registered");
    }

    registeredEmails.push(data.email);

    return {
      id: Date.now(),
      name: data.name,
      email: data.email,
    };
  }
}
```

### Test it

```bash
# Valid registration
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "Secret123"}'

# Invalid - missing uppercase in password
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob", "email": "bob@example.com", "password": "secret123"}'
```
