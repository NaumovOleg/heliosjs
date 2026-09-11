---
description: Register error handlers at the controller or method level with @Catch.
---

# Catch Middleware Decorator

The `@Catch` decorator registers error handlers at the controller or method level.

## Purpose

When a route handler throws an error, `@Catch` intercepts it and runs your custom handler instead of returning a generic 500 response.

## Signature

```typescript
type ErrorHandler = (error: Error, req: Request, res: Response) => unknown;
```

A `@Catch` handler doesn't call `res.send()`-style methods — it **returns**
the value that becomes the response body, optionally after setting
`res.status`.

## Basic Usage

```typescript
import { Controller, Get } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

@Controller("/users")
@Catch((error, req, res) => {
  console.error("Error:", error.message);
  res.status = 500;
  return { error: error.message };
})
export class UserController {
  @Get("/")
  findAll() {
    throw new Error("Database connection failed");
  }
}
```

## Controller-Level Error Handler

```typescript
import { Controller, Get, Params, NotFoundError, ValidationError } from "@heliosjs/core";
import { Catch } from "@heliosjs/middlewares";

const errorHandler = (error: Error, req: any, res: any) => {
  // Handle known errors
  if (error instanceof NotFoundError) {
    res.status = 404;
    return { success: false, error: { message: error.message } };
  }

  if (error instanceof ValidationError) {
    res.status = 400;
    return { success: false, error: { message: error.message, details: (error as any).details } };
  }

  // Unknown errors
  console.error(`[${req.requestId}] Unhandled error:`, error);
  res.status = 500;
  return { success: false, error: { message: "Internal server error" } };
};

@Controller("/api")
@Catch(errorHandler)
export class ApiController {
  @Get("/users/:id")
  getUser(@Params("id") id: string) {
    const user = findUser(id);
    if (!user) throw new NotFoundError("User", id);
    return user;
  }
}
```

## Method-Level Error Handler

```typescript
@Controller("/users")
export class UserController {
  @Post("/")
  @Catch((error, req, res) => {
    console.error("Create user failed:", error.message);
    res.status = 400;
    return { error: "Could not create user" };
  })
  create(@Body() data: any) {
    // If this throws, the method-level handler runs
  }
}
```

## Stacking Multiple Error Handlers

Method-level handlers run before controller-level:

```typescript
const logError = (error: Error, req: any, res: any) => {
  console.error(`[${new Date().toISOString()}] ${error.name}: ${error.message}`);
  throw error; // Re-throw to pass to next handler
};

const formatError = (error: Error, req: any, res: any) => {
  res.status = (error as any).status || 500;
  return {
    success: false,
    error: {
      name: error.name,
      message: error.message,
      requestId: req.requestId,
    },
  };
};

@Controller("/api")
@Catch(formatError)     // Runs second (after logError re-throws)
export class ApiController {
  @Get("/data")
  @Catch(logError)      // Runs first
  getData() {
    throw new Error("Something went wrong");
  }
}
```

## Async Error Handlers

Error handlers can be asynchronous:

```typescript
import { Catch } from "@heliosjs/middlewares";

const asyncErrorHandler = async (error: Error, req: any, res: any) => {
  // Log to external service
  await errorTrackingService.report({
    error: error.message,
    stack: error.stack,
    requestId: req.requestId,
    path: req.path,
    timestamp: new Date().toISOString(),
  });

  res.status = 500;
  return { error: "Internal server error", requestId: req.requestId };
};

@Controller("/api")
@Catch(asyncErrorHandler)
export class ApiController {}
```

## Error Handler with Context

```typescript
const createErrorHandler = (serviceName: string) => {
  return (error: Error, req: any, res: any) => {
    console.error(`[${serviceName}] ${error.name}: ${error.message}`);

    res.status = (error as any).status || 500;
    return { service: serviceName, error: error.message, path: req.path };
  };
};

@Controller("/users")
@Catch(createErrorHandler("UserService"))
export class UserController {}

@Controller("/posts")
@Catch(createErrorHandler("PostService"))
export class PostController {}
```

## Remarks

- The error handler can be synchronous or asynchronous
- Method-level handlers run before controller-level
- Multiple handlers can be stacked (use `throw error` to pass to the next one)
- Separates error handling logic from business logic
