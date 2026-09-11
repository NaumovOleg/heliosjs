---
sidebar_position: 1
---

# Intro

Welcome to HeliosJS! A decorator-first Node.js framework for building REST APIs, WebSocket servers, and serverless functions with TypeScript.

## Quick Start

```typescript
import "reflect-metadata";
import { Controller, Get, Post, Body, Params } from "@heliosjs/core";
import { Server, Helios } from "@heliosjs/http";

@Controller("/users")
class UserController {
  private users = [{ id: 1, name: "Alice" }];

  @Get("/")
  findAll() {
    return this.users;
  }

  @Get("/:id")
  findOne(@Params("id") id: string) {
    return this.users.find((u) => u.id === Number(id));
  }

  @Post("/")
  create(@Body() data: { name: string }) {
    const user = { id: this.users.length + 1, ...data };
    this.users.push(user);
    return user;
  }
}

@Server({ controllers: [UserController] })
class App {}

const server = new Helios(App);
server.listen(3000);
```

```bash
curl http://localhost:3000/users       # [{ "id": 1, "name": "Alice" }]
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Bob"}'
```

## What You Can Build

- **REST APIs** — controllers, validation, error handling, CORS, rate limiting
- **WebSocket servers** — topic pub/sub, real-time messaging
- **Server-Sent Events** — push notifications to clients
- **GraphQL APIs** — type-graphql resolvers with subscriptions
- **AWS Lambda functions** — API Gateway, ALB, CloudFront, Function URL
- **gRPC services** — server + client with RxJS observables

## Feature Overview

| Feature             | Package                 | Description                                                                              |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Controllers         | `@heliosjs/core`        | `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`                              |
| Parameter Injection | `@heliosjs/core`        | `@Body`, `@Params`, `@QueryParam`, `@Headers`, `@Req`, `@Res`, `@Cookies`, `@Fingerprint` |
| Validation          | `@heliosjs/core`        | DTO classes with `class-validator` decorators, or `compileSchema()` (JSON Schema / Ajv) for a faster hot-route path |
| Error Handling      | `@heliosjs/core`        | `NotFoundError`, `ValidationError`, `ForbiddenError`, etc.                               |
| Middleware          | `@heliosjs/middlewares` | `@Use`, `@Guard`, `@Roles`, `@Catch`, `@Intercept`, `@Pipe`, `@Sanitize`, `@Cors`        |
| Rate Limiting       | `@heliosjs/core`        | `@RateLimit` with fixed window, sliding window, token bucket strategies                  |
| HTTP Server         | `@heliosjs/http`        | `@Server`, `Helios`, WebSocket, SSE, GraphQL                                             |
| AWS Lambda          | `@heliosjs/aws`         | `Helios` adapter for API Gateway, ALB, CloudFront, Function URL                          |
| gRPC                | `@heliosjs/grpc`        | `GrpcModule`, `GrpcServer`, `GrpcClient`, decorators                                     |

## What You'll Learn

| Part | Topic                | What you'll do                                |
| ---- | -------------------- | --------------------------------------------- |
| 1    | Installation & Setup | Create a new project and install HeliosJS     |
| 2    | Controllers          | Create controllers with CRUD routes           |
| 3    | Routing & Parameters | Handle dynamic routes, query strings, headers |
| 4    | Validation           | Validate incoming data with DTOs              |
| 5    | Error Handling       | Handle errors with built-in error classes     |
| 6    | Middleware           | Add logging, CORS, guards, interceptors       |
| 7    | HTTP Server          | WebSocket, SSE, GraphQL, plugins              |
| 8    | AWS Lambda           | Deploy to Lambda with API Gateway             |
| 9    | gRPC                 | Build microservices with gRPC                 |

## Prerequisites

- **Node.js** 20 or higher
- **npm** or **yarn**
- Basic knowledge of TypeScript

## Getting Help

- Open an [issue on GitHub](https://github.com/NaumovOleg/heliosjs/issues)

## Ready to Start?

**Next:** [Installation & Setup](./core-module/installation)
