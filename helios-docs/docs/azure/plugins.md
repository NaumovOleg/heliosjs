---
description: The @heliosjs/azure Plugin interface — lifecycle hooks, registration, and examples for logging, metrics, database pooling, and trace correlation.
---

# Custom Plugins for Azure Functions

Plugins extend the Azure Functions adapter with lifecycle hooks. Use them for
logging, metrics, database connections, or any cross-cutting concern.

## Azure Plugin Interface

```typescript
interface Plugin {
  name: string;
  onInit?(app: IAzureAdapter): void | Promise<void>;
  hooks?: {
    beforeRequest?(req: HttpRequest, context: InvocationContext): void | Promise<void>;
    beforeRoute?(req: Request, res: Response): void | Promise<void>;
    afterResponse?(req: Request, res: Response): void | Promise<void>;
  };
}
```

Like the AWS `Plugin`, the Azure `Plugin` has **no `middleware` field** —
`beforeRoute` (which runs once the framework `Request` exists) is the closest
equivalent. `beforeRequest` here gets the **raw** Azure `HttpRequest`/
`InvocationContext`, before any framework `Request` is built.

`onInit` only receives `app` — it fires once, synchronously, from inside
`usePlugin` (typically at cold start), before any invocation exists, so
there's no live `HttpRequest`/`InvocationContext` to hand it. Reach for
`hooks.beforeRequest` when a hook needs the raw per-invocation objects.

## Registering Plugins

```typescript
import { Helios } from "@heliosjs/azure";
import { Root } from "./controllers";

const app = new Helios(Root);
app.usePlugin(loggingPlugin);
app.usePlugin(metricsPlugin);

export const adapter = app;
```

## Plugin Examples

### Logging Plugin

`context.log`/`context.trace`/`context.error` are the recommended way to log
on Azure Functions — unlike `console.log`, they integrate with Application
Insights automatically.

```typescript
import { Plugin } from "@heliosjs/azure";

const loggingPlugin: Plugin = {
  name: "logging",

  hooks: {
    beforeRequest(_req, context) {
      context.log(`Processing ${context.invocationId}`);
    },
    afterResponse(req) {
      console.log("Request completed", req.path);
    },
  },
};
```

### Metrics Plugin

`req.startTime` is set by the framework itself — no manual bookkeeping
needed. `afterResponse` only gets the framework `Request`/`Response`, not the
raw `InvocationContext`, so capture anything you need from `context` in
`beforeRequest` via closure (`onInit` runs before any invocation and never
sees a real `InvocationContext`):

```typescript
import { Plugin } from "@heliosjs/azure";

const createMetricsPlugin = (): Plugin => {
  let functionName = "unknown";

  return {
    name: "metrics",

    hooks: {
      beforeRequest(_req, context) {
        functionName = context.functionName;
      },
      afterResponse(req, res) {
        const duration = Date.now() - req.startTime;
        console.log(JSON.stringify({
          type: "metric",
          duration,
          path: req.path,
          status: res.status,
          functionName,
        }));
      },
    },
  };
};
```

### Database Connection Plugin

```typescript
import { Plugin } from "@heliosjs/azure";
import { Pool } from "pg";

const createDbPlugin = (config: any): Plugin => {
  let pool: Pool;

  return {
    name: "database",

    async onInit() {
      pool = new Pool(config);
      console.log("Database pool created");
    },

    hooks: {
      beforeRoute(req) {
        req.setState("db", pool);
      },
    },
  };
};

// Usage
const app = new Helios(Root);
app.usePlugin(createDbPlugin({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Keep pool small on the Consumption plan
}));
```

### Trace Correlation Plugin

Azure's native distributed-tracing mechanism is the `InvocationContext`'s
`traceContext` (W3C Trace Context), not a custom header the way AWS X-Ray
uses `x-amzn-trace-id`. `beforeRoute` only receives the framework `Request`,
but that's enough — `req.getAzureContext()` (added by `@heliosjs/core` for
this adapter) hands back the raw `InvocationContext`:

```typescript
import { Plugin } from "@heliosjs/azure";
import type { InvocationContext } from "@azure/functions";

const tracingPlugin: Plugin = {
  name: "tracing",

  hooks: {
    beforeRoute(req) {
      const context = req.getAzureContext() as InvocationContext;
      console.log("traceparent:", context.traceContext?.traceParent);
    },
    afterResponse(req, res) {
      console.log(JSON.stringify({
        type: "trace",
        path: req.path,
        status: res.status,
      }));
    },
  },
};
```

## Plugin Lifecycle

| Hook | When | Arguments |
|------|------|-----------|
| `onInit` | When registered via `usePlugin` (typically cold start) | `app` |
| `beforeRequest` | Before the raw request is parsed | `HttpRequest`, `InvocationContext` |
| `beforeRoute` | Before route dispatch | `Request`, `Response` |
| `afterResponse` | After response is built | `Request`, `Response` |

## Best Practices

- Keep plugins focused on a single responsibility
- Use `onInit` for one-time setup (database connections, configuration)
- Use `hooks.afterResponse` for cleanup and metrics
- Avoid blocking the request lifecycle with synchronous I/O
- Handle cold starts gracefully, same as on any serverless platform
- Use small connection pools for database plugins, especially on the Consumption plan
- Prefer `context.log`/`context.error` over `console.log` for anything you want in Application Insights

## Related

- [Azure Functions Integration](./functions-integration) — the adapter
  itself, the `{*path}` catch-all routing pattern, a full CRUD example
