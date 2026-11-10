---
sidebar_position: 7
---

# HTTP Server

The `@Server` decorator configures your HTTP server, and the `Helios` class starts and manages it.

## Purpose

`@Server` is where cross-cutting, app-wide config lives — CORS, global
middleware, the error handler, WebSocket/SSE/GraphQL, RBAC — as opposed to
`@Controller`-level config, which applies to one route group. Most of it
has a controller/route-level equivalent (`@Cors` vs `cors`, `@Catch` vs
`errorHandler`) for the cases that need to differ per route; `@Server`'s
version is what applies everywhere nothing more specific overrides it.

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
| `host`           | `string`                                  | Hostname or IP to bind to                              |
| `canonicalHost`  | `string`                                  | Trusted public authority for generated absolute URLs   |
| `controllers`    | `ControllerType[]`                        | Controller classes                                     |
| `middlewares`    | `MiddlewareCB[]`                          | Global middleware functions                            |
| `cors`           | `CORSConfig`                              | CORS configuration                                     |
| `interceptor`    | `InterceptorCB`                           | Global response interceptor                            |
| `errorHandler`   | `(error, req, res) => any`                | Global error handler                                   |
| `sanitizers`     | `SanitizerConfig[]`                       | Global sanitization rules                              |
| `statics`        | `StaticConfig[]`                          | Static file serving                                    |
| `websocket`      | `WebSocketServerOptions & { controllers }`| WebSocket config; see [WebSocket](./websockets)        |
| `sse`            | `SSEServerOptions & { enabled }`           | SSE config; see [SSE](./server-sent-events)            |
| `graphql`        | `{ path, resolvers, pubSub, playground }` | GraphQL config                                         |
| `rbac`           | `{ getRoles: (req) => roles }`            | RBAC extractor                                         |
| `fingerprint`    | `{ secret?, components?, compute? }`      | Fingerprint config                                     |
| `log`            | `LoggerConfig \| false`                   | Logging config (see [Logging](../core-module/logging)) |
| `bodyLimit`      | `number`                                  | Max request body size in bytes. Default 1 MB; `0` disables the limit |
| `trustProxy`     | `boolean`                                 | Trust forwarded headers. Default `false`; only enable behind a controlled proxy |
| `requestTimeout` | `number`                                  | Node's `http.Server.requestTimeout` in ms              |
| `headersTimeout` | `number`                                  | Node's `http.Server.headersTimeout` in ms              |

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
    const status = serialized.status || 500;
    res.status = status;
    return {
      success: false,
      error: {
        code: serialized.code || 'INTERNAL_SERVER_ERROR',
        status,
        message: status >= 500 ? 'Internal Server Error' : serialized.message,
        requestId: req.requestId,
      },
    };
  },
})
export class App {}
```

Use `serializeError()` for server-side logging, but do not return its complete
object to clients: upstream response bodies, stacks, and internal exception
messages may contain secrets or infrastructure details.

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
        dotfiles: 'ignore',
      },
    },
  ],
})
export class App {}
```

Static mounts resolve the real path and reject traversal or symlink escapes
outside the configured root. Dotfiles are ignored by default; use
`dotfiles: 'deny'` to return `403`, or `'allow'` only for an intentionally
public dotfile.

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

`canonicalHost` is useful when the `Host` header is rewritten or supplied by an
untrusted client. When set, `req.getHost()` and `req.getFullUrl()` use this
authority instead of the incoming `Host` value. Set it to the public host your
application is actually served from, for example `api.example.com`.

## Security Defaults

HTTP responses include these headers unless the application sets them first:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` on requests recognized as HTTPS

The default body limit is 1 MiB and applies to GraphQL requests as well. Keep
the limit finite in production; use `0` only when an upstream gateway already
enforces an appropriate limit.

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
  cors: { origin: 'https://app.example.com', credentials: true },
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

## Related

- [CORS](../middlewares/cors) — the `@Cors` decorator version of this page's
  `cors` option, for per-controller/route overrides
- [WebSocket](./websockets) — the `websocket` option in depth
- [Server-Sent Events](./server-sent-events) — the `sse` option in depth
- [Plugins](./plugins) — hook into server lifecycle/requests without
  forking `Helios` itself
