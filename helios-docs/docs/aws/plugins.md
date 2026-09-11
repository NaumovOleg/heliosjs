---
sidebar_position: 13
---

# Custom Plugins for AWS Lambda

Plugins extend the Lambda adapter with lifecycle hooks. Use them for logging, metrics, database connections, or any cross-cutting concern.

## Lambda Plugin Interface

```typescript
interface Plugin {
  name: string;
  onInit?(app: ILambdaAdapter, event: LambdaEvent, context: Context): void | Promise<void>;
  hooks?: {
    beforeRequest?(event: LambdaEvent, context: Context): void | Promise<void>;
    beforeRoute?(req: Request, res: Response): void | Promise<void>;
    afterResponse?(req: Request, res: Response): void | Promise<void>;
  };
}
```

Unlike the `@heliosjs/http` plugin interface, the AWS `Plugin` has **no
`middleware` field** — `beforeRoute` (which runs once the framework `Request`
exists) is the closest equivalent. `beforeRequest` here gets the **raw**
Lambda `event`/`context`, before any framework `Request` is built — there's
no `IncomingMessage` on Lambda.

## Registering Plugins

```typescript
import { Helios } from "@heliosjs/aws";
import { Root } from "./controllers";

const app = new Helios(Root);
app.usePlugin(loggingPlugin);
app.usePlugin(metricsPlugin);

export const handler = app.handler;
```

## Plugin Examples

### Logging Plugin

```typescript
import { Plugin } from "@heliosjs/aws";

const loggingPlugin: Plugin = {
  name: "logging",

  onInit(app, event, context) {
    console.log(`Lambda: ${context.functionName}, Memory: ${context.memoryLimitInMB}MB`);
  },

  hooks: {
    beforeRequest(event, context) {
      console.log(`Processing ${context.awsRequestId}`);
    },
    afterResponse(req, res) {
      console.log("Request completed");
    },
  },
};
```

### Metrics Plugin

`req.startTime` is set by the framework itself — no manual bookkeeping needed:

```typescript
import { Plugin } from "@heliosjs/aws";

const metricsPlugin: Plugin = {
  name: "metrics",

  hooks: {
    afterResponse(req, res) {
      const duration = Date.now() - req.startTime;
      console.log(JSON.stringify({
        type: "metric",
        duration,
        path: req.path,
        status: res.status,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      }));
    },
  },
};
```

### Database Connection Plugin

```typescript
import { Plugin } from "@heliosjs/aws";
import { Pool } from "pg";

const createDbPlugin = (config: any): Plugin => {
  let pool: Pool;

  return {
    name: "database",

    async onInit(app, event, context) {
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
  max: 5, // Keep pool small for Lambda
}));
```

### X-Ray Tracing Plugin

```typescript
import { Plugin } from "@heliosjs/aws";

const tracingPlugin: Plugin = {
  name: "tracing",

  hooks: {
    beforeRoute(req) {
      // req is the framework Request here, so getHeader() is available
      // (beforeRequest only gets the raw Lambda event/context).
      const traceId = req.getHeader("x-amzn-trace-id");
      console.log("Trace ID:", traceId);
    },
    afterResponse(req, res) {
      // Add custom annotations
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
| `onInit` | Lambda cold start | `app`, `event`, `context` |
| `beforeRequest` | Before the raw event is parsed | `LambdaEvent`, `Context` |
| `beforeRoute` | Before route dispatch | `Request`, `Response` |
| `afterResponse` | After response is built | `Request`, `Response` |

## Best Practices

- Keep plugins focused on a single responsibility
- Use `onInit` for one-time setup (database connections, configuration)
- Use `hooks.afterResponse` for cleanup and metrics
- Avoid blocking the request lifecycle with synchronous I/O
- Lambda plugins should handle cold starts gracefully
- Use small connection pools for database plugins
