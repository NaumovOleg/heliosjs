---
sidebar_position: 7
description: Configure and use HeliosJS's built-in leveled logger — levels, format, and the global framework logger.
---

# Logging

HeliosJS ships a small leveled console logger (`Logger`), exported from
`@heliosjs/core`. The framework uses one instance internally for startup
messages, plugin errors, and request errors; you can configure that instance
or create your own for application logs.

## Log Levels

From most to least severe: `fatal`, `error`, `warn`, `log` (the default),
`debug`, `verbose`. A message is printed only when its level is at least as
severe as the logger's configured level. `silent` suppresses everything.

```typescript
type LogLevel = "silent" | "fatal" | "error" | "warn" | "log" | "debug" | "verbose";
```

## Creating a Logger

```typescript
import { Logger } from "@heliosjs/core";

// Default config: level 'log', prefix 'Helios', timestamps and colors on
const logger = new Logger();

// With a context tag only (uses default config)
const dbLogger = new Logger("db");

// With full config
const paymentsLogger = new Logger({
  level: "debug",
  prefix: "Payments",
  timestamp: true,
  colors: true,
});
```

### `LoggerConfig`

| Property    | Type       | Default    | Description                              |
| ----------- | ---------- | ---------- | ----------------------------------------- |
| `level`     | `LogLevel` | `'log'`    | Minimum level to print.                   |
| `prefix`    | `string`   | `'Helios'` | Label printed after the level tag.        |
| `timestamp` | `boolean`  | `true`     | Prepend an ISO timestamp to each line.    |
| `colors`    | `boolean`  | `true`     | Colorize output with ANSI escape codes.   |

## Logging Methods

```typescript
logger.fatal("out of memory");
logger.error("payment failed", { orderId: 42 });
logger.warn("retrying request");
logger.log("server started"); // or logger.info(...) — same thing
logger.debug("cache miss", key);
logger.verbose("full request payload", body);
```

Every method accepts a message plus any number of extra arguments, all passed
through to the underlying `console.*` call.

## Level Control at Runtime

```typescript
logger.setLevel("debug"); // start printing debug/verbose
logger.getLevel(); // 'debug'
```

## Child Loggers

`child()` returns a new logger with the same config plus an extra context tag,
printed after the prefix — useful for tagging output per subsystem:

```typescript
const logger = new Logger({ prefix: "Api" });
const webhooksLogger = logger.child("webhooks");

webhooksLogger.log("received event"); // [LOG] Api webhooks received event
```

## The Global Framework Logger

The framework itself logs through one shared instance — server startup
config, plugin hook failures (`getGlobalLogger().error(...)`), and (unless a
route handles the error itself) request errors.

```typescript
import { getGlobalLogger, setGlobalLogger } from "@heliosjs/core";

// Read the current global logger
getGlobalLogger().log("custom message using the framework's logger");

// Replace it
setGlobalLogger({ level: "warn", prefix: "MyApp" });

// Silence all framework logging
setGlobalLogger(false);
```

### Configuring It via `@Server` / `GrpcServer`

The HTTP and gRPC adapters build and install the global logger for you from a
`log` option — you rarely need to call `setGlobalLogger` directly:

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [ApiController],
  log: { level: "debug", prefix: "API" },
})
export class App {}

// Or disable framework logging entirely:
@Server({
  controllers: [ApiController],
  log: false,
})
export class Silent {}
```

```typescript
import { GrpcServer } from "@heliosjs/grpc";

const server = new GrpcServer({
  url: "0.0.0.0:50051",
  protoPath: "./app.proto",
  package: "app.v1",
  log: { level: "log", prefix: "gRPC" },
});
```

:::note
The AWS Lambda adapter (`@heliosjs/aws`) does not take a `log` option — Lambda
already captures `console.*` output in CloudWatch, so application code should
log directly (or construct its own `Logger`) rather than configuring one
through the adapter.
:::

## Remarks

- `Logger`, `LoggerConfig`, `LogLevel`, `setGlobalLogger`, and
  `getGlobalLogger` are all exported from `@heliosjs/core`.
- Output goes to `console.error` for `fatal`/`error`, `console.warn` for
  `warn`, and `console.log` for everything else.
- `log: false` in `@Server({ log: false })` is the quickest way to silence
  framework output in tests.
