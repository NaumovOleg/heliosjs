---
description: Validate and clean request data with Joi schemas using @Sanitize and the built-in SANITIZER helpers.
---

# Sanitize Middleware Decorator

The `@Sanitize` decorator applies Joi-based sanitization to request data.

## Purpose

Sanitization cleans incoming data (trim whitespace, strip unknown fields, apply defaults) before it reaches your handler. HeliosJS provides a built-in `SANITIZER` utility with common Joi schemas.

## SANITIZER Utility

The `SANITIZER` object provides pre-built Joi schemas:

```typescript
import { SANITIZER } from "@heliosjs/core";

// String schemas
SANITIZER.string.trim()       // Joi.string().trim()
SANITIZER.string.email()      // Joi.string().email().trim().lowercase()
SANITIZER.string.name()       // 2-50 chars, letters/spaces/hyphens only
SANITIZER.string.slug()       // lowercase alphanumeric with hyphens
SANITIZER.string.phone()      // digits, spaces, +, -, (, )

// Number schemas
SANITIZER.number.integer()    // Integer only
SANITIZER.number.positive()   // Positive numbers
SANITIZER.number.range(1, 100) // Min/max range

// Object schemas
SANITIZER.object.stripUnknown(schema) // Strip unknown properties
SANITIZER.object.withDefaults(schema) // Strip unknowns + apply defaults

// Date schemas
SANITIZER.date.iso()          // ISO 8601 dates
SANITIZER.date.timestamp()    // Unix timestamps

// XSS protection
SANITIZER.xss()               // Strip script tags, event handlers, data: URIs
```

## Basic Usage

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { Sanitize } from "@heliosjs/middlewares";
import { SANITIZER } from "@heliosjs/core";

@Controller("/users")
@Sanitize({
  type: "body",
  schema: SANITIZER.object.withDefaults({
    name: SANITIZER.string.name(),
    email: SANITIZER.string.email(),
    bio: SANITIZER.xss(),
  }),
})
export class UserController {
  @Post("/")
  create(@Body() data: { name: string; email: string; bio: string }) {
    // data.name is trimmed, email is lowercased, bio is XSS-sanitized
    return { id: 1, ...data };
  }
}
```

## Multiple Sanitization Rules

```typescript
import { Sanitize } from "@heliosjs/middlewares";
import { SANITIZER } from "@heliosjs/core";

@Controller("/products")
@Sanitize([
  {
    type: "body",
    schema: SANITIZER.object.withDefaults({
      name: SANITIZER.string.trim(),
      price: SANITIZER.number.positive(),
      description: SANITIZER.xss(),
    }),
  },
  {
    type: "query",
    schema: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
    }),
  },
])
export class ProductController {}
```

## Sanitize Action Modes

The `action` property controls what the sanitization does:

| Action | Behavior |
|--------|----------|
| `"both"` (default) | Validate and convert/sanitize in one pass |
| `"validate"` | Reject invalid data; no type conversion or defaults applied |
| `"sanitize"` | Convert types and apply defaults; missing-but-required fields don't reject |

```typescript
// Validate-only mode - rejects invalid data
@Sanitize({
  type: "body",
  action: "validate",
  schema: Joi.object({
    email: Joi.string().email().required(),
  }),
})

// Sanitize-only mode - applies defaults, no rejection
@Sanitize({
  type: "body",
  action: "sanitize",
  schema: Joi.object({
    name: SANITIZER.string.trim(),
    role: Joi.string().default("user"),
  }),
})
```

## Real-World Examples

### User Registration

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { Sanitize } from "@heliosjs/middlewares";
import { SANITIZER } from "@heliosjs/core";

@Controller("/auth")
@Sanitize({
  type: "body",
  schema: SANITIZER.object.withDefaults({
    name: SANITIZER.string.name(),
    email: SANITIZER.string.email(),
    password: Joi.string().min(8),
    bio: SANITIZER.xss(),
    website: Joi.string().uri().allow("", null),
  }),
})
export class AuthController {
  @Post("/register")
  register(@Body() data: any) {
    return { id: 1, ...data };
  }
}
```

### Search Endpoint

```typescript
@Controller("/search")
@Sanitize({
  type: "query",
  schema: Joi.object({
    q: SANITIZER.string.trim().min(1).max(200),
    page: SANITIZER.number.integer().min(1).default(1),
    limit: SANITIZER.number.range(1, 50).default(20),
    sort: Joi.string().valid("relevance", "date", "price").default("relevance"),
  }),
})
export class SearchController {
  @Get("/")
  search(@QueryParam("q") query: string) {
    return { query, results: [] };
  }
}
```

### Admin Input with XSS Protection

```typescript
@Controller("/admin")
@Sanitize({
  type: "body",
  schema: SANITIZER.object.withDefaults({
    title: SANITIZER.string.trim(),
    content: SANITIZER.xss(),
    slug: SANITIZER.string.slug(),
    category: SANITIZER.string.trim().lowercase(),
    tags: Joi.array().items(SANITIZER.string.trim().lowercase()).default([]),
  }),
})
export class AdminController {
  @Post("/posts")
  createPost(@Body() data: any) {
    return { id: 1, ...data };
  }
}
```

## Metadata Handling

The decorator attaches sanitization config as metadata. The framework applies sanitization during request processing before validation and handler execution.

## Remarks

- Multiple sanitization configs can be applied by passing an array
- The `SANITIZER` utility provides reusable Joi schemas for common patterns
- Sanitization runs before validation, so validated data is already clean
- Use `stripUnknown: true` to remove unexpected fields
- XSS sanitization strips `<script>` tags, `on*` event handlers, and `javascript:` URLs
