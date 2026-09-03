# Architecture

**Analysis Date:** 2026-09-03

## Pattern Overview

**Overall:** Decorator-driven MVC framework with adapter pattern

**Key Characteristics:**
- Decorators define routes, middleware, validation, and server config
- Reflect Metadata stores configuration on class prototypes
- Adapter pattern: same controller logic for HTTP, Lambda, gRPC
- Monorepo with 5 workspace packages sharing `@heliosjs/core`

## Layers

**Core (`@heliosjs/core`):**
- Purpose: Decorators, metadata, types, route matching, middleware pipeline
- Location: `src/core/src/`
- Contains: Decorators, type definitions, utility functions, error classes
- Depends on: `reflect-metadata`, `class-validator`, `class-transformer`, `joi`, `ws`
- Used by: All other packages

**HTTP (`@heliosjs/http`):**
- Purpose: HTTP server runtime, request/response factories, plugin system
- Location: `src/http/src/`
- Contains: `Helios` class, HTTP decorators, request/response handling
- Depends on: `@heliosjs/core`, `type-graphql`, `graphql-yoga`, `ws`
- Used by: End users creating HTTP servers

**AWS (`@heliosjs/aws`):**
- Purpose: AWS Lambda adapter for Helios controllers
- Location: `src/aws/src/`
- Contains: Lambda `Helios` class, event normalizers, response factories
- Depends on: `@heliosjs/core`, `aws-lambda`
- Used by: Users deploying to AWS Lambda

**gRPC (`@heliosjs/grpc`):**
- Purpose: gRPC server and client with decorator-based service registration
- Location: `src/grpc/src/`
- Contains: `GrpcServer`, `GrpcClient`, decorators, proto loading
- Depends on: `@grpc/grpc-js`, `rxjs`
- Used by: Users building gRPC services

**Middlewares (`@heliosjs/middlewares`):**
- Purpose: Reusable middleware implementations
- Location: `src/middlewares/src/`
- Contains: CORS, guards, pipes, RBAC, rate limiting, sanitization, interceptors
- Depends on: `@heliosjs/core`
- Used by: End users composing middleware stacks

## Data Flow

**HTTP Request:**

1. `http.createServer` receives raw `IncomingMessage`
2. `RequestFactory.create` builds `Request` object
3. Plugin hooks: `beforeRequest` → `beforeRoute`
4. CORS handling
5. Global/static middleware execution
6. `runController` dispatches to matching controller
7. Controller method executes with parameter decorators
8. `ResponseFactory` builds response
9. `sendResponse` writes to socket
10. Plugin hook: `afterResponse`

**Lambda Request:**

1. Lambda handler receives `event` + `context`
2. `getEventType` detects REST/HTTP/URL format
3. `RequestFactory.create` normalizes event to `Request`
4. Controller dispatch via `CONTROLLER_REQUEST`
5. `toLambdaResponse` formats for API Gateway

**gRPC Request:**

1. `GrpcServer` loads proto definitions
2. Service methods registered as handlers
3. Handler receives `call` object
4. Observable/Promise/sync results handled
5. Callback returns response or streams

## Key Abstractions

**Controller:**
- Purpose: Route handler class with decorator-based configuration
- Examples: `src/core/src/Controller.ts`, `src/core/src/decorators.ts`
- Pattern: Class decorator + method decorators + Reflect Metadata

**Middleware:**
- Purpose: Request/response interceptors
- Examples: `src/middlewares/src/*.ts`
- Pattern: `(req, res, next) => Promise<void>` callbacks

**Plugin:**
- Purpose: Lifecycle hooks for HTTP and Lambda
- Examples: `src/http/src/utils/http/plugin.ts`, `src/aws/src/utils/aws/plugin.ts`
- Pattern: Base class with `beforeRequest`, `beforeRoute`, `afterResponse` hooks

**Adapter:**
- Purpose: Platform-specific request/response normalization
- Examples: `src/http/src/Helios.ts`, `src/aws/src/lambda.ts`, `src/grpc/src/server.ts`
- Pattern: Same controller logic, different transport layer

## Entry Points

**HTTP Server:**
- Location: `src/http/src/Helios.ts`
- Triggers: `new Helios(AppModule)` then `app.listen()`
- Responsibilities: Creates HTTP server, compiles controllers, handles requests

**Lambda Handler:**
- Location: `src/aws/src/lambda.ts`
- Triggers: AWS Lambda invocation
- Responsibilities: Normalizes events, runs controller, formats Lambda response

**gRPC Server:**
- Location: `src/grpc/src/server.ts`
- Triggers: `new GrpcServer()` then `server.start()`
- Responsibilities: Loads protos, registers services, binds port

## Error Handling

**Strategy:** Custom error classes with status codes

**Patterns:**
- `ApplicationError` base class for serialization (`src/core/src/utils/core/error/apperror.ts`)
- Typed errors: `NotFoundError`, `ValidationError`, `ForbiddenError`, `UnauthorizedError`, etc.
- `getErrorType` utility for detecting error objects
- Stack traces included only when `NODE_ENV !== 'production'`

## Cross-Cutting Concerns

**Logging:** `console.log` for startup; no structured logging framework
**Validation:** `class-validator` decorators on DTOs; `joi` schemas
**Authentication:** None built-in; RBAC via user-provided `RolesExtractor`
**CORS:** Built-in `handleCORS` in core, configurable via `@Server` decorator

---

*Architecture analysis: 2026-09-03*
