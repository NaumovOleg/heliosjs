---
sidebar_position: 11
---

# Custom Plugins

Plugins hook into the server lifecycle to add reusable functionality like logging, metrics, database connections, or authentication.

## Plugin Interface

```typescript
interface Plugin {
  name: string;
  onInit?(server: Server): void | Promise<void>;
  onStart?(server: Server): void | Promise<void>;
  onStop?(server: Server): void | Promise<void>;
  middleware?: MiddlewareCB;
  hooks?: {
    beforeRequest?(req: IncomingMessage): void | Promise<void>;
    beforeRoute?(req: Request, res: Response): void | Promise<void>;
    afterResponse?(req: Request, res: Response): void | Promise<void>;
  };
}
```

`middleware` and `hooks.beforeRoute` / `hooks.afterResponse` receive the
**framework** `Request`/`Response` — not raw Node objects, and not an
EventEmitter, so there's no `res.on(...)`. Only `hooks.beforeRequest` sees the
raw Node `IncomingMessage`, before a framework `Request` even exists.

## Basic Plugin

```typescript
import { Plugin } from "@heliosjs/http";

const loggerPlugin: Plugin = {
  name: "logger",

  onInit(server) {
    console.log("Server initialized");
  },

  onStart(server) {
    console.log("Server started");
  },

  onStop(server) {
    console.log("Server stopped");
  },

  middleware(req, res, next) {
    (req as any)._start = Date.now();
    next();
  },

  hooks: {
    beforeRequest(req) {
      // Runs before raw HTTP processing
    },
    beforeRoute(req, res) {
      // Runs before route dispatch
    },
    afterResponse(req, res) {
      const duration = Date.now() - ((req as any)._start ?? Date.now());
      console.log(`${req.method} ${req.path} ${res.status} ${duration}ms`);
    },
  },
};
```

## Register Plugins

```typescript
import { Server, Helios } from "@heliosjs/http";

@Server({ controllers: [ApiController] })
class App {}

const server = new Helios(App);
server.usePlugin(loggerPlugin);
server.usePlugin(metricsPlugin);
await server.listen(3000);
```

## Plugin Examples

### Metrics Plugin

```typescript
import { Plugin } from "@heliosjs/http";

const metricsPlugin: Plugin = {
  name: "metrics",

  hooks: {
    // req.startTime is set by the framework itself — no bookkeeping needed.
    afterResponse(req, res) {
      const duration = Date.now() - req.startTime;
      metrics.increment(`http.requests.${req.method}.${res.status}`);
      metrics.histogram("http.duration", duration);
    },
  },
};
```

### Database Connection Plugin

```typescript
import { Plugin } from "@heliosjs/http";
import { Pool } from "pg";

const createDbPlugin = (config: any): Plugin => {
  let pool: Pool;

  return {
    name: "database",

    async onInit() {
      pool = new Pool(config);
      console.log("Database connected");
    },

    async onStop() {
      await pool.end();
      console.log("Database disconnected");
    },

    middleware(req: any, res, next) {
      req.setState("db", pool);
      next();
    },
  };
};

// Usage
server.usePlugin(createDbPlugin({ connectionString: process.env.DATABASE_URL }));
```

### Rate Limiting Plugin

This is a minimal illustration of writing plugin middleware — for real rate
limiting, prefer the built-in [`@RateLimit`](../core-module/rate-limiting.md)
decorator, which has pluggable strategies and a shared in-memory store with
proper eviction.

```typescript
import { Plugin } from "@heliosjs/http";

const createRateLimitPlugin = (maxRequests: number, windowMs: number): Plugin => {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return {
    name: "rateLimit",

    middleware(req: any, res, next) {
      const ip = req.getClientIp();
      const now = Date.now();
      const record = requests.get(ip);

      if (record && record.resetAt > now) {
        if (record.count >= maxRequests) {
          res.status = 429;
          res.data = { error: "Too many requests" };
          return; // not calling next() stops the pipeline here
        }
        record.count++;
      } else {
        requests.set(ip, { count: 1, resetAt: now + windowMs });
      }

      next();
    },
  };
};
```

### Authentication Plugin

```typescript
import { Plugin } from "@heliosjs/http";
import jwt from "jsonwebtoken";

const createAuthPlugin = (secret: string): Plugin => ({
  name: "auth",

  hooks: {
    beforeRoute(req: any, res) {
      const token = req.getHeader("authorization")?.replace("Bearer ", "");
      if (token) {
        try {
          const payload = jwt.verify(token, secret);
          req.setState("user", payload);
        } catch {
          // Invalid token - let route handler deal with it
        }
      }
    },
  },
});
```

## Lifecycle Hooks

| Hook | When | Arguments |
|------|------|-----------|
| `onInit` | Server construction | `server` instance |
| `onStart` | Server starts listening | `server` instance |
| `onStop` | Server stops | `server` instance |
| `beforeRequest` | Raw HTTP request | `IncomingMessage` |
| `beforeRoute` | Before route dispatch | `Request`, `Response` |
| `afterResponse` | After response sent | `Request`, `Response` |
| `middleware` | Every request | `req`, `res`, `next` |

## Multiple Plugins

Plugins execute in registration order:

```typescript
server.usePlugin(requestIdPlugin);     // 1st
server.usePlugin(loggingPlugin);       // 2nd
server.usePlugin(authPlugin);          // 3rd
```

## Remarks

- Plugins are objects with a `name` and optional lifecycle hooks
- `middleware` runs on every request, before route dispatch
- `hooks.beforeRequest` runs before raw HTTP processing
- `hooks.beforeRoute` runs after framework parsing, before routing
- `hooks.afterResponse` runs after the response is sent
- Use `onInit` for setup, `onStop` for cleanup
