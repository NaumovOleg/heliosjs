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
| `bodyLimit`    | `number`                                  | Max request body size in bytes. Default 1 MB; `0` disables the limit |
| `trustProxy`   | `boolean`                                 | Trust `X-Forwarded-For`/`X-Forwarded-Proto` for `getClientIp()`/`isSecure()`. Default `false` — only enable behind a proxy you control |
| `requestTimeout` | `number`                                | Node's `http.Server.requestTimeout` in ms               |
| `headersTimeout` | `number`                                | Node's `http.Server.headersTimeout` in ms                |

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
import { serializeError } from '@heliosjs/core/utils';

@Server({
  controllers: [ApiController],
  errorHandler: (error, req, res) => {
    console.error(`[${req.requestId}]`, error);
    const serialized = serializeError(error);
    res.status = serialized.status || 500;
    return { success: false, error: serialized };
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

## Body Size and Proxy Trust

```typescript
@Server({
  controllers: [ApiController],
  bodyLimit: 5 * 1024 * 1024, // 5 MB (default is 1 MB; 0 disables the limit)
  trustProxy: true, // only behind a proxy/load balancer you control
})
export class App {}
```

`trustProxy` controls whether `req.getClientIp()` and `req.isSecure()` honor
`X-Forwarded-For` / `X-Forwarded-Proto`. Leave it `false` (the default) unless
you're behind a reverse proxy — these headers are client-spoofable, and both
rate limiting and fingerprinting key off `getClientIp()` by default.

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

@Controller({ prefix: "/api", controllers: [UserController, PostController] })
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
import { Controller, Get, Post, Body, Params, Req } from '@heliosjs/core';
import { Server, Helios } from '@heliosjs/http';
import { Guard, Cors } from '@heliosjs/middlewares';

// --- Controllers ---

@Controller('/health')
export class HealthController {
  @Get('/')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

// A guard returns boolean | string — true to allow, false/a message to reject
// with 403 (unlike a @Use middleware, it can't call next() or write the response).
const isAuthenticated = (req: any) => !!req.getHeader('authorization') || 'Unauthorized';

@Controller('/api/users')
@Guard(isAuthenticated)
export class UserController {
  @Get('/')
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }

  @Get('/:id')
  findOne(@Params('id') id: string) {
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
    res.status = 500;
    return { error: error.message };
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
