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
    beforeRequest?(req: IncomingMessage): void | Promise<void>;
    beforeRoute?(req: Request, res: Response): void | Promise<void>;
    afterResponse?(req: Request, res: Response): void | Promise<void>;
  };
}
```

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
    beforeRequest(req) {
      console.log("Processing request");
    },
    afterResponse(req, res) {
      console.log("Request completed");
    },
  },
};
```

### Metrics Plugin

```typescript
import { Plugin } from "@heliosjs/aws";

const metricsPlugin: Plugin = {
  name: "metrics",

  hooks: {
    beforeRequest(req) {
      (req as any)._startTime = Date.now();
    },
    afterResponse(req: any, res) {
      const duration = Date.now() - (req._startTime || 0);
      console.log(JSON.stringify({
        type: "metric",
        duration,
        path: req.url,
        statusCode: res.statusCode,
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

    middleware(req: any, res, next) {
      req.setState("db", pool);
      next();
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
    beforeRequest(req) {
      const traceId = req.getHeader("x-amzn-trace-id");
      console.log("Trace ID:", traceId);
    },
    afterResponse(req, res) {
      // Add custom annotations
      console.log(JSON.stringify({
        type: "trace",
        path: req.url,
        statusCode: res.statusCode,
      }));
    },
  },
};
```

## Plugin Lifecycle

| Hook | When | Arguments |
|------|------|-----------|
| `onInit` | Lambda cold start | `app`, `event`, `context` |
| `beforeRequest` | Before raw HTTP processing | `IncomingMessage` |
| `beforeRoute` | Before route dispatch | `Request`, `Response` |
| `afterResponse` | After response sent | `Request`, `Response` |

## Best Practices

- Keep plugins focused on a single responsibility
- Use `onInit` for one-time setup (database connections, configuration)
- Use `hooks.afterResponse` for cleanup and metrics
- Avoid blocking the request lifecycle with synchronous I/O
- Lambda plugins should handle cold starts gracefully
- Use small connection pools for database plugins
