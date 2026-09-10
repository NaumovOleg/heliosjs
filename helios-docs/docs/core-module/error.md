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
import { Controller, Get, Param, NotFoundError } from "@heliosjs/core";

@Controller("/users")
export class UserController {
  @Get("/:id")
  findOne(@Param("id") id: string) {
    const user = database.findUser(id);
    if (!user) {
      throw new NotFoundError("User", id);
    }
    return user;
  }
}
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "status": 404,
    "message": "User with id '123' not found",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

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

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

const errorHandler = (error: Error, req: any, res: any) => {
  console.error(`[${req.requestId}] Error:`, error.message);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: { message: error.message, details: (error as any).details },
    });
  }

  if (error.name === "NotFoundError") {
    return res.status(404).json({
      success: false,
      error: { message: error.message },
    });
  }

  return res.status(500).json({
    success: false,
    error: { message: "Internal server error" },
  });
};

@Controller("/users")
@Catch(errorHandler)
export class UserController {
  // All errors in this controller are caught by errorHandler
}
```

### Method-Level Error Handler

```typescript
import { Controller, Post, Body } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

@Controller("/users")
export class UserController {
  @Post("/")
  @Catch((error: Error, req: any, res: any) => {
    console.error("Create user failed:", error.message);
    return res.status(500).json({ error: "Failed to create user" });
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
  return res.status(500).json({ error: error.message });
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

## serializeError Utility

The `serializeError` function converts any error type into a standardized `SerializedError` object:

```typescript
import { serializeError } from "@heliosjs/core";

// Works with HeliosJS errors
const heliosError = new NotFoundError("User", "123");
serializeError(heliosError);
// {
//   type: "NotFoundError",
//   message: "User with id '123' not found",
//   status: 404,
//   code: "NOT_FOUND",
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

Check if a value is an error of any recognized type:

```typescript
import { isError } from "@heliosjs/core";

isError(new NotFoundError("User", "1"));    // true
isError(new Error("fail"));                 // true
isError("error string");                    // false
isError(null);                              // false
```

## getErrorType Utility

Classify an error with confidence level:

```typescript
import { getErrorType } from "@heliosjs/core";

getErrorType(new NotFoundError("User", "1"));
// { isError: true, type: "NotFoundError", confidence: "high" }

getErrorType({ message: "fail", status: 404 });
// { isError: true, type: "ErrorObject", confidence: "medium" }
```

## Global Error Handler via @Server

Register a global error handler in your server configuration:

```typescript
import { Server } from "@heliosjs/http";
import { serializeError } from "@heliosjs/core";

@Server({
  controllers: [UserController],
  errorHandler: (error, req, res) => {
    console.error(`[${req.requestId}]`, error);

    const serialized = serializeError(error);
    const status = serialized.status || 500;

    return res.status(status).json({
      success: false,
      error: serialized,
    });
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
  Param,
  Headers,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitExceededError,
} from "@heliosjs/core";
import { Catch, Guard } from "@heliosjs/middlewares";

const errorHandler = (error: Error, req: any, res: any) => {
  const status = (error as any).status || 500;
  return res.status(status).json({
    success: false,
    error: {
      name: error.name,
      message: error.message,
      timestamp: new Date().toISOString(),
    },
  });
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
