---
sidebar_position: 14
---

# Rate Limiting

HeliosJS provides built-in rate limiting via the `@RateLimit` decorator with multiple strategies.

## Basic Usage

```typescript
import { Controller, Get, RateLimit } from "@heliosjs/core";

@Controller("/api")
export class ApiController {
  // Allow 100 requests per minute
  @RateLimit({ max: 100, windowMs: 60_000 })
  @Get("/data")
  getData() { return { data: [] }; }

  // Allow 10 requests per second for expensive operations
  @RateLimit({ max: 10, windowMs: 1000 })
  @Get("/expensive")
  expensiveOperation() { return computeExpensiveResult(); }
}
```

## Rate Limit Options

| Property | Type | Description |
|----------|------|-------------|
| `max` | `number` | Maximum requests allowed in the window |
| `windowMs` | `number` | Time window in milliseconds |
| `strategy` | `RateLimitStrategy` | Rate limiting algorithm |
| `keyGen` | `(req) => string` | Custom key generator |
| `onLimit` | `(req, res) => void \| Promise<void>` | Custom limit exceeded hook |
| `cost` | `number` | Cost per request (default: 1) |

## Strategies

### Fixed Window (default)

Resets counter at fixed intervals. Simple but can allow burst at window boundaries.

```typescript
import { RateLimit, fixedWindow } from "@heliosjs/core";

@RateLimit({
  max: 100,
  windowMs: 60_000,
  strategy: fixedWindow(),
})
@Get("/")
handler() { return {}; }
```

### Sliding Window

Smooths bursts by using a weighted average of two adjacent windows.

```typescript
import { RateLimit, slidingWindow } from "@heliosjs/core";

@RateLimit({
  max: 100,
  windowMs: 60_000,
  strategy: slidingWindow(),
})
@Get("/")
handler() { return {}; }
```

### Token Bucket

Allows bursts up to capacity, then refills at a steady rate.

```typescript
import { RateLimit, tokenBucket } from "@heliosjs/core";

@RateLimit({
  max: 100,        // bucket capacity
  windowMs: 60_000,
  strategy: tokenBucket({ refillRate: 10 }), // 10 tokens/second
})
@Get("/")
handler() { return {}; }
```

## Custom Key Generator

By default, the rate limit key is the request fingerprint. Override it:

```typescript
@RateLimit({
  max: 100,
  windowMs: 60_000,
  keyGen: (req) => req.getClientIp(), // Limit by IP
})
@Get("/")
handler() { return {}; }

// Or by user ID
@RateLimit({
  max: 1000,
  windowMs: 60_000,
  keyGen: (req) => req.getState("user")?.id || "anonymous",
})
@Get("/")
handler() { return {}; }
```

## Custom Cost

Some requests are more expensive than others:

```typescript
@RateLimit({
  max: 100,
  windowMs: 60_000,
  cost: 1, // Normal request
})
@Get("/light")
light() { return {}; }

@RateLimit({
  max: 100,
  windowMs: 60_000,
  cost: 5, // Expensive request costs 5 tokens
})
@Get("/heavy")
heavy() { return computeHeavyResult(); }
```

## Custom Limit Handler

`onLimit` is a **side-effect hook**, not a response override — it fires right
before the request is rejected, and whatever it does (or throws) can't stop
the 429: HeliosJS always throws `RateLimitExceededError` afterward, and any
error `onLimit` itself throws is swallowed so it can't mask that result. Use
it for logging, metrics, or alerting; use `@Catch` if you want to change the
response body a rate-limit breach produces.

```typescript
@RateLimit({
  max: 100,
  windowMs: 60_000,
  onLimit: (req, res) => {
    metrics.increment("rate_limit.exceeded", { path: req.path });
    console.warn(`Rate limit hit by ${req.getClientIp()} on ${req.path}`);
  },
})
@Get("/")
handler() { return {}; }
```

## Global Rate Limit Configuration

`setRateLimitConfig` sets the default `strategy` / `keyGen` / `onLimit` used
by every `@RateLimit` decorator that doesn't specify its own — `max` and
`windowMs` always come from the decorator itself and can't be defaulted this
way. Call it once, before the server starts handling requests:

```typescript
import { setRateLimitConfig, slidingWindow } from "@heliosjs/core";

setRateLimitConfig({
  strategy: slidingWindow(),
  keyGen: (req) => req.getClientIp(),
});
```

```typescript
import "reflect-metadata";
import { Server, Helios } from "@heliosjs/http";

@Server({ controllers: [ApiController] })
export class App {}

// setRateLimitConfig(...) above already applies to every @RateLimit below this
const server = new Helios(App);
await server.listen(3000);
```

## Response Headers

Rate limiting automatically sets these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests in window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Window reset time (Unix timestamp) |

## Controller-Level Rate Limiting

Apply rate limiting to all routes in a controller:

```typescript
@RateLimit({ max: 1000, windowMs: 60_000 })
@Controller("/api")
export class ApiController {
  @Get("/fast")
  fast() { return {}; }

  @Get("/slow")
  slow() { return {}; }
}
```

## Remarks

- The `@RateLimit` decorator is from `@heliosjs/core`
- Default strategy is fixed window with in-memory store
- The `MemoryStore` works for single-instance deployments; use a shared store (Redis) for distributed systems
- Rate limit key defaults to the request fingerprint
- Headers are set automatically on every response
