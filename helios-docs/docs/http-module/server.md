---
sidebar_position: 7
---

# HTTP Server

The `@Server` decorator configures your HTTP server, and the `Helios` class starts and manages it.

## Basic Setup

```typescript
import 'reflect-metadata';
import { Controller, Get } from '@heliosjs/core';
import { Server, Helios } from '@heliosjs/http';

@Controller('/health')
export class HealthController {
  @Get('/')
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}

@Server({
  port: 3000,
  controllers: [HealthController],
})
export class App {}

const server = new Helios(App);
await server.listen();
```

## @Server Configuration Options

| Property       | Type                                      | Description                                            |
| -------------- | ----------------------------------------- | ------------------------------------------------------ |
| `port`         | `number`                                  | Port to listen on                                      |
| `host`         | `string`                                  | Hostname or IP to bind to                              |
| `controllers`  | `ControllerType[]`                        | Controller classes                                     |
| `middlewares`  | `MiddlewareCB[]`                          | Global middleware functions                            |
| `cors`         | `CORSConfig`                              | CORS configuration                                     |
| `interceptor`  | `InterceptorCB`                           | Global response interceptor                            |
| `errorHandler` | `(error, req, res) => any`                | Global error handler                                   |
| `sanitizers`   | `SanitizerConfig[]`                       | Global sanitization rules                              |
| `statics`      | `StaticConfig[]`                          | Static file serving                                    |
| `websocket`    | `{ path: string; lazy?: boolean }`        | WebSocket config                                       |
| `sse`          | `{ enabled: boolean }`                    | SSE config                                             |
| `graphql`      | `{ path, resolvers, pubSub, playground }` | GraphQL config                                         |
| `rbac`         | `{ getRoles: (req) => roles }`            | RBAC extractor                                         |
| `fingerprint`  | `{ secret?, components?, compute? }`      | Fingerprint config                                     |
| `log`          | `LoggerConfig \| false`                   | Logging config (see [Logging](../core-module/logging)) |

## Global Middleware

```typescript
import { Server } from '@heliosjs/http';

const requestLogger = (req: any, res: any, next: any) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
};

const corsMiddleware = (req: any, res: any, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
};

@Server({
  controllers: [HealthController],
  middlewares: [requestLogger, corsMiddleware],
})
export class App {}
```

## CORS Configuration

```typescript
@Server({
  controllers: [ApiController],
  cors: {
    origin: ['https://app.example.com', 'https://admin.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  },
})
export class App {}
```

## Global Error Handler

```typescript
import { Server } from '@heliosjs/http';
import { serializeError } from '@heliosjs/core';

@Server({
  controllers: [ApiController],
  errorHandler: (error, req, res) => {
    console.error(`[${req.requestId}]`, error);
    const serialized = serializeError(error);
    const status = serialized.status || 500;
    return res.status(status).json({ success: false, error: serialized });
  },
})
export class App {}
```

## Static File Serving

```typescript
import path from 'path';

@Server({
  controllers: [ApiController],
  statics: [
    {
      path: path.join(__dirname, '../public'),
      options: {
        index: 'index.html',
        maxAge: '1d',
        immutable: true,
      },
    },
  ],
})
export class App {}
```

## RBAC and Fingerprint

```typescript
import { Server } from '@heliosjs/http';

@Server({
  controllers: [ApiController],
  rbac: {
    getRoles: (req) => req.getState('user')?.roles ?? [],
  },
  fingerprint: {
    secret: process.env.FP_SECRET,
    components: ['ip', 'userAgent'],
  },
})
export class App {}
```

## Helios Server API

```typescript
import { Helios } from '@heliosjs/http';

const server = new Helios(App);

// Start server
await server.listen(3000, '0.0.0.0');

// Add middleware at runtime
server.use((req, res, next) => {
  console.log('Runtime middleware');
  next();
});

// Check status
const status = server.status();
console.log(status.running); // true
console.log(status.config); // { port: 3000, ... }

// Stop server
await server.close();
```

## Nested Controllers

Group controllers under a prefix:

```typescript
import { Controller } from "@heliosjs/core";

@Controller("/api", controllers: [UserController, PostController])
export class RootController {}

@Server({
  controllers: [RootController],
})
export class App {}
// Routes: /api/users/..., /api/posts/...
```

## Full Application Example

```typescript
import 'reflect-metadata';
import path from 'path';
import { Controller, Get, Post, Body, Param, Req } from '@heliosjs/core';
import { Server, Helios } from '@heliosjs/http';
import { Catch, Use, Guard, Cors } from '@heliosjs/middlewares';

// --- Controllers ---

@Controller('/health')
export class HealthController {
  @Get('/')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

const authGuard = (req: any, res: any, next: any) => {
  if (!req.getHeader('authorization')) {
    res.statusCode = 401;
    return { error: 'Unauthorized' };
  }
  next();
};

@Controller('/api/users')
@Guard(authGuard)
export class UserController {
  @Get('/')
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id: Number(id), name: 'Alice' };
  }

  @Post('/')
  create(@Body() data: { name: string }) {
    return { id: Date.now(), ...data };
  }
}

// --- App ---

@Server({
  controllers: [HealthController, UserController],
  cors: { origin: '*', credentials: true },
  statics: [{ path: path.join(__dirname, '../public'), options: { index: 'index.html' } }],
  errorHandler: (error, req, res) => {
    console.error(error);
    return res.status(500).json({ error: error.message });
  },
})
export class App {}

// --- Entry ---

const server = new Helios(App);
server.listen(3000).then(() => {
  console.log('API running on http://localhost:3000');
});
```

## Remarks

- The `@Server` decorator configures the server; `Helios` instantiates and runs it
- Global middleware runs before any controller middleware
- Static files are served with caching headers by default
- `server.use()` adds middleware at runtime (after construction)
- WebSocket and SSE are enabled via their respective config options
