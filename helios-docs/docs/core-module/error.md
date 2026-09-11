---
sidebar_position: 4
---

# Error Handling

HeliosJS provides built-in error classes and a `@Catch` decorator for structured error handling.

## Built-in Error Classes

| Error Class | HTTP Status | Usage |
|-------------|-------------|-------|
| `NotFoundError` | 404 | Resource not found |
| `ValidationError` | 400 | Validation failed |
| `UnauthorizedError` | 401 | Authentication required |
| `ForbiddenError` | 403 | Access denied |
| `PayloadTooLargeError` | 413 | Request body too large |
| `RateLimitExceededError` | 429 | Too many requests |
| `DuplicateEntryError` | 409 | Duplicate resource |
| `InvalidStateError` | 409 | Invalid state for operation |
| `ServiceUnavailableError` | 503 | Service unavailable |
| `DependencyFailedError` | 424 | Upstream dependency failed |
| `InternalServerError` | 500 | Internal server error |

## Using Built-in Errors

### NotFoundError

```typescript
import { Controller, Get, Params, NotFoundError } from "@heliosjs/core";

@Controller("/users")
export class UserController {
  @Get("/:id")
  findOne(@Params("id") id: string) {
    const user = database.findUser(id);
    if (!user) {
      throw new NotFoundError("User", id);
    }
    return user;
  }
}
```

`new NotFoundError(message, id?, options?)` uses `message` as-is — it does
**not** build a sentence for you. The optional `id` is attached to
`error.details` instead:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "status": 404,
    "message": "User",
    "details": [{ "id": "123" }],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

Pass a full sentence yourself (built with a template string) if you want the
message to include the id.

### ValidationError

```typescript
import { Controller, Post, Body, ValidationError } from "@heliosjs/core";

@Controller("/users")
export class UserController {
  @Post("/")
  create(@Body() data: any) {
    if (!data.email) {
      throw new ValidationError([
        { field: "email", constraint: "Email is required" },
      ]);
    }
    if (!data.name) {
      throw new ValidationError([
        { field: "name", constraint: "Name is required" },
        { field: "name", constraint: "Name must be at least 2 characters" },
      ]);
    }
    // ...
  }
}
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
      { "field": "email", "constraint": "Email is required" },
      { "field": "name", "constraint": "Name is required" }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### UnauthorizedError & ForbiddenError

```typescript
import { Controller, Get, Headers, UnauthorizedError, ForbiddenError } from "@heliosjs/core";

@Controller("/admin")
export class AdminController {
  @Get("/dashboard")
  dashboard(@Headers("authorization") auth: string) {
    if (!auth) {
      throw new UnauthorizedError("Missing authorization token");
    }

    const user = decodeToken(auth);
    if (user.role !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    return { stats: { users: 100, posts: 500 } };
  }
}
```

### RateLimitExceededError

```typescript
import { RateLimitExceededError } from "@heliosjs/core";

// Thrown automatically by @RateLimit decorator when limit is exceeded
// Or throw manually:
throw new RateLimitExceededError("Too many requests. Try again later.");
```

### Other Errors

```typescript
import {
  DuplicateEntryError,
  InvalidStateError,
  ServiceUnavailableError,
  DependencyFailedError,
  PayloadTooLargeError,
  InternalServerError,
} from "@heliosjs/core";

// Duplicate entry (e.g., unique constraint violation)
throw new DuplicateEntryError("A user with this email already exists");

// Invalid state
throw new InvalidStateError("Cannot delete a published post");

// Service unavailable
throw new ServiceUnavailableError("Database is temporarily unavailable");

// Upstream dependency failed
throw new DependencyFailedError("Payment gateway returned 503");

// Payload too large
throw new PayloadTooLargeError("File exceeds 10MB limit");

// Internal error
throw new InternalServerError("Unexpected error occurred");
```

## Error Response Structure

All errors produce a consistent response:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;       // e.g., "NOT_FOUND", "VALIDATION_FAILED"
    status: number;     // HTTP status code
    message: string;    // Human-readable message
    details?: Array<{   // Optional, for validation errors
      field?: string;
      value?: any;
      constraint?: string;
    }>;
    timestamp: string;  // ISO 8601
    requestId?: string; // If available
  };
}
```

## @Catch Decorator

The `@Catch` decorator registers error handlers at the controller or method level. Error handlers receive the error, request, and response objects.

### Controller-Level Error Handler

A `@Catch` handler doesn't call `res.send()`-style methods — it just
**returns** the value that becomes the response body (and can set `res.status`
first):

```typescript
import { Controller, Get, Response, Request } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

const errorHandler = (error: Error, req: Request, res: Response) => {
  console.error(`[${req.requestId}] Error:`, error.message);

  if (error.name === "ValidationError") {
    res.status = 400;
    return { success: false, error: { message: error.message, details: (error as any).details } };
  }

  if (error.name === "NotFoundError") {
    res.status = 404;
    return { success: false, error: { message: error.message } };
  }

  res.status = 500;
  return { success: false, error: { message: "Internal server error" } };
};

@Controller("/users")
@Catch(errorHandler)
export class UserController {
  // All errors in this controller are caught by errorHandler
}
```

### Method-Level Error Handler

```typescript
import { Controller, Post, Body, Response } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

@Controller("/users")
export class UserController {
  @Post("/")
  @Catch((error: Error, req, res: Response) => {
    console.error("Create user failed:", error.message);
    res.status = 500;
    return { error: "Failed to create user" };
  })
  create(@Body() data: any) {
    // If this throws, the method-level handler runs
  }
}
```

### Multiple Error Handlers

You can stack `@Catch` decorators. Method-level handlers run before controller-level:

```typescript
const logError = (error: Error, req: any, res: any) => {
  console.error("Log:", error.message);
  // Re-throw to let the next handler deal with response
  throw error;
};

const respondError = (error: Error, req: any, res: any) => {
  res.status = 500;
  return { error: error.message };
};

@Controller("/users")
@Catch(respondError)
export class UserController {
  @Post("/")
  @Catch(logError)
  create() {
    // logError runs first, then respondError if error propagates
  }
}
```

These three helpers live in **`@heliosjs/core/utils`**, not the package root.

## serializeError Utility

`serializeError` flattens any error-like value into a `SerializedError` —
`type` is one of `'HeliosError' | 'Error' | 'HttpError' | 'AxiosError' | 'ValidationError' | 'Unknown'`:

```typescript
import { serializeError } from "@heliosjs/core/utils";

// Helios errors (anything with .code + .toResponse()) become "HttpError"
const heliosError = new NotFoundError("User", "123");
serializeError(heliosError);
// {
//   type: "HttpError",
//   message: "User",
//   status: 404,
//   code: "NOT_FOUND",
//   details: [{ id: "123" }],
//   ...
// }

// Works with Axios errors
serializeError(axiosError);
// {
//   type: "AxiosError",
//   message: "Request failed with status code 404",
//   status: 404,
//   data: { ... }
// }

// Works with class-validator errors
serializeError(validationError);
// {
//   type: "ValidationError",
//   message: "Validation failed",
//   errors: [...]
// }

// Works with plain Error objects
serializeError(new Error("Something broke"));
// {
//   type: "Error",
//   message: "Something broke"
// }
```

## isError Utility

Check if a value is an error of any recognized type — note that any
non-empty string or number also counts as "error-shaped":

```typescript
import { isError } from "@heliosjs/core/utils";

isError(new NotFoundError("User", "1"));    // true
isError(new Error("fail"));                 // true
isError("error string");                    // true  — non-empty strings count
isError(null);                              // false
isError({});                                 // false — no message/status/code
```

## getErrorType Utility

Classify a value and say whether it's an error:

```typescript
import { getErrorType } from "@heliosjs/core/utils";

getErrorType(new NotFoundError("User", "1"));
// { isError: true, type: "HeliosError", confidence: "high" }

getErrorType(new Error("fail"));
// { isError: true, type: "Error", confidence: "high" }

getErrorType(null);
// { isError: false, type: null, confidence: "high" }
```

## Global Error Handler via @Server

Register a global error handler in your server configuration:

Like `@Catch`, the global `errorHandler` returns the response body directly —
it runs as a catch-all after any route- or controller-level `@Catch`:

```typescript
import { Server } from "@heliosjs/http";
import { serializeError } from "@heliosjs/core/utils";

@Server({
  controllers: [UserController],
  errorHandler: (error, req, res) => {
    console.error(`[${req.requestId}]`, error);

    const serialized = serializeError(error);
    res.status = serialized.status || 500;

    return { success: false, error: serialized };
  },
})
export class App {}
```

## Complete Example: Error Handling in Practice

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Params,
  Headers,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitExceededError,
} from "@heliosjs/core";
import { Catch, Guard } from "@heliosjs/middlewares";

const errorHandler = (error: Error, req: any, res: any) => {
  res.status = (error as any).status || 500;
  return {
    success: false,
    error: {
      name: error.name,
      message: error.message,
      timestamp: new Date().toISOString(),
    },
  };
};

@Controller("/api")
@Catch(errorHandler)
export class ApiController {
  @Get("/public")
  publicEndpoint() {
    return { data: "public" };
  }

  @Post("/create")
  create(@Body() data: any) {
    if (!data.name) {
      throw new ValidationError([{ field: "name", constraint: "Required" }]);
    }
    return { created: true, ...data };
  }

  @Get("/admin")
  @Guard((req) => !!req.getHeader("authorization"))
  adminEndpoint(@Headers("authorization") auth: string) {
    if (!auth.startsWith("Bearer admin-")) {
      throw new ForbiddenError("Admin access required");
    }
    return { secret: "admin data" };
  }
}
```
