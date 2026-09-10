---
sidebar_position: 3
---

# Controllers

## What is a Controller?

A controller is a class that handles incoming HTTP requests. Each method decorated with a route decorator (`@Get`, `@Post`, etc.) becomes an endpoint.

## Basic CRUD Controller

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  QueryParam,
  NotFoundError,
} from "@heliosjs/core";

interface User {
  id: number;
  name: string;
  email: string;
}

let users: User[] = [];
let nextId = 1;

@Controller("/users")
export class UserController {
  @Get("/")
  findAll(
    @QueryParam("search") search?: string,
  ) {
    if (search) {
      return users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return users;
  }

  @Get("/:id")
  findOne(@Param("id") id: string) {
    const user = users.find((u) => u.id === Number(id));
    if (!user) {
      throw new NotFoundError("User", id);
    }
    return user;
  }

  @Post("/")
  create(@Body() data: Omit<User, "id">) {
    const user: User = { id: nextId++, ...data };
    users.push(user);
    return user;
  }

  @Put("/:id")
  replace(@Param("id") id: string, @Body() data: Omit<User, "id">) {
    const userId = Number(id);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new NotFoundError("User", id);
    }
    users[index] = { id: userId, ...data };
    return users[index];
  }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() data: Partial<Omit<User, "id">>) {
    const user = users.find((u) => u.id === Number(id));
    if (!user) {
      throw new NotFoundError("User", id);
    }
    Object.assign(user, data);
    return user;
  }

  @Delete("/:id")
  remove(@Param("id") id: string) {
    const index = users.findIndex((u) => u.id === Number(id));
    if (index === -1) {
      throw new NotFoundError("User", id);
    }
    users.splice(index, 1);
    return { deleted: true };
  }
}
```

## Controller Configuration Object

Use the config form for more control:

```typescript
import { Controller, Get, Req } from "@heliosjs/core";

@Controller({
  prefix: "/api/v1/users",
  middlewares: [loggingMiddleware],
})
export class UserController {
  @Get("/")
  findAll() {
    return [];
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `prefix` | `string` | Base path prefix for all routes |
| `middlewares` | `MiddlewareCB[]` | Middlewares applied to every route in this controller |
| `controllers` | `ControllerClass[]` | Nested child controllers |

## Nested Routing

Group related controllers under a parent prefix:

```typescript
import { Controller } from "@heliosjs/core";

@Controller("/api", controllers: [UserController, PostController])
export class RootController {}
```

This creates routes like `/api/users/...` and `/api/posts/...`.

You can nest multiple levels:

```typescript
@Controller("/api/v1", controllers: [
  UserController,
  PostController,
  CommentController,
])
export class V1Controller {}

@Controller("/api/v2", controllers: [UserControllerV2])
export class V2Controller {}

@Controller({ controllers: [V1Controller, V2Controller] })
export class RootController {}
```

## Route Decorators

| Decorator | HTTP Method | Description |
|-----------|-------------|-------------|
| `@Get(path)` | GET | Retrieve data |
| `@Post(path)` | POST | Create new resources |
| `@Put(path)` | PUT | Replace entire resource |
| `@Patch(path)` | PATCH | Partial update |
| `@Delete(path)` | DELETE | Remove resources |
| `@Options(path)` | OPTIONS | Get allowed methods |
| `@Head(path)` | HEAD | Get headers only |
| `@Query(path)` | QUERY | Idempotent query with body |
| `@Any()` | * | Handle all methods |

## The @Any Catch-All

Use `@Any()` as a fallback handler for unmatched routes:

```typescript
import { Controller, Any, Req } from "@heliosjs/core";

@Controller({ prefix: "api", controllers: [UserController] })
export class RootController {
  @Any()
  fallback(@Req() req: any) {
    return { message: `No route matched: ${req.method} ${req.path}` };
  }
}
```

## Registering Controllers

### Via @Server (HTTP)

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [UserController, PostController],
  port: 3000,
})
export class App {}
```

### Via @Controller with nested controllers

```typescript
@Controller("/api", controllers: [UserController, PostController])
export class RootController {}
```

## Route Priority

Routes are matched by specificity. More specific routes should be defined first:

```typescript
@Controller("/users")
export class UserController {
  // Specific route first
  @Get("/profile")
  getProfile() {
    return { page: "profile" };
  }

  // Parameterized route after
  @Get("/:id")
  getUserById(@Param("id") id: string) {
    return { userId: id };
  }
}
```

## Accessing Request State

Use `setState` / `getState` to pass data between middleware and handlers:

```typescript
import { Controller, Get, Req } from "@heliosjs/core";
import { Use, Guard } from "@heliosjs/middlewares";

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.getHeader("authorization");
  if (!token) {
    res.statusCode = 401;
    return;
  }
  req.setState("user", { id: 1, name: "Alice", roles: ["admin"] });
  next();
};

@Controller("/profile")
@Use(authMiddleware)
export class ProfileController {
  @Get("/")
  getProfile(@Req() req: any) {
    const user = req.getState("user");
    return user;
  }
}
```

## Returning Different Response Types

Controllers can return objects, arrays, strings, or use the Response object directly:

```typescript
import { Controller, Get, Res, Response } from "@heliosjs/core";

@Controller("/examples")
export class ExamplesController {
  // Object auto-serialized to JSON
  @Get("/json")
  json() {
    return { message: "hello" };
  }

  // String returned as text/plain
  @Get("/text")
  text() {
    return "plain text";
  }

  // Array auto-serialized to JSON
  @Get("/list")
  list() {
    return [1, 2, 3];
  }

  // Manual response control
  @Get("/custom")
  custom(@Res() res: Response) {
    res.setHeader("X-Custom", "value");
    return { data: "with custom header" };
  }
}
```

## Full Example: Task Management API

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  QueryParam,
  Headers,
  NotFoundError,
  ValidationError,
} from "@heliosjs/core";

interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

let tasks: Task[] = [];
let nextId = 1;

@Controller("/tasks")
export class TaskController {
  @Get("/")
  list(
    @QueryParam("completed") completed?: string,
    @QueryParam("page") page?: string,
    @QueryParam("limit") limit?: string,
  ) {
    let filtered = [...tasks];

    if (completed !== undefined) {
      const isCompleted = completed === "true";
      filtered = filtered.filter((t) => t.completed === isCompleted);
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const start = (pageNum - 1) * limitNum;

    return {
      data: filtered.slice(start, start + limitNum),
      total: filtered.length,
      page: pageNum,
    };
  }

  @Get("/:id")
  findOne(@Param("id") id: string) {
    const task = tasks.find((t) => t.id === Number(id));
    if (!task) {
      throw new NotFoundError("Task", id);
    }
    return task;
  }

  @Post("/")
  create(
    @Body() data: { title: string },
    @Headers("authorization") auth: string,
  ) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError([
        { field: "title", constraint: "Title is required" },
      ]);
    }

    const task: Task = {
      id: nextId++,
      title: data.title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    tasks.push(task);
    return task;
  }

  @Put("/:id")
  replace(@Param("id") id: string, @Body() data: { title: string; completed: boolean }) {
    const index = tasks.findIndex((t) => t.id === Number(id));
    if (index === -1) {
      throw new NotFoundError("Task", id);
    }
    tasks[index] = { ...tasks[index], ...data };
    return tasks[index];
  }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() data: Partial<Task>) {
    const task = tasks.find((t) => t.id === Number(id));
    if (!task) {
      throw new NotFoundError("Task", id);
    }
    Object.assign(task, data);
    return task;
  }

  @Delete("/:id")
  remove(@Param("id") id: string) {
    const index = tasks.findIndex((t) => t.id === Number(id));
    if (index === -1) {
      throw new NotFoundError("Task", id);
    }
    tasks.splice(index, 1);
    return { deleted: true, id: Number(id) };
  }
}
```

### Test it

```bash
# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"title": "Buy groceries"}'

# List tasks
curl http://localhost:3000/tasks

# List completed tasks
curl http://localhost:3000/tasks?completed=true

# Get single task
curl http://localhost:3000/tasks/1

# Update task
curl -X PATCH http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Delete task
curl -X DELETE http://localhost:3000/tasks/1
```

## Decorator Summary

| Decorator | Level | Description |
|-----------|-------|-------------|
| `@Controller(path)` | Class | Define base route prefix |
| `@Controller({ prefix, middlewares, controllers })` | Class | Config form |
| `@Get(path)` | Method | GET route |
| `@Post(path)` | Method | POST route |
| `@Put(path)` | Method | PUT route |
| `@Patch(path)` | Method | PATCH route |
| `@Delete(path)` | Method | DELETE route |
| `@Options(path)` | Method | OPTIONS route |
| `@Head(path)` | Method | HEAD route |
| `@Query(path)` | Method | QUERY route (body-carrying idempotent) |
| `@Any()` | Method | Catch-all for any method |
| `@Body(name?)` | Parameter | Extract request body |
| `@Param(name?)` | Parameter | Extract URL parameter |
| `@QueryParam(name?)` | Parameter | Extract query string parameter |
| `@Headers(name?)` | Parameter | Extract HTTP header |
| `@Cookies(name?)` | Parameter | Extract cookie |
| `@Files(name?)` | Parameter | Extract multipart file |
| `@Req()` | Parameter | Inject raw request object |
| `@Res()` | Parameter | Inject raw response object |
| `@Fingerprint()` | Parameter | Inject computed fingerprint |
