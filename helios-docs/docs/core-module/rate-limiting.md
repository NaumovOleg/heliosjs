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
| `onLimit` | `(req, res, record) => void` | Custom limit exceeded handler |
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

Override the default 429 response:

```typescript
@RateLimit({
  max: 100,
  windowMs: 60_000,
  onLimit: (req, res, record) => {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((record.resetAt - Date.now()) / 1000),
    });
  },
})
@Get("/")
handler() { return {}; }
```

## Global Rate Limit Configuration

Set default strategy for all `@RateLimit` decorators:

```typescript
import { Server } from "@heliosjs/http";
import { slidingWindow, tokenBucket } from "@heliosjs/core";

@Server({
  controllers: [ApiController],
  // Global rate limit defaults
  // (configured via setRateLimitConfig in your entry point)
})
export class App {}
```

```typescript
import { setRateLimitConfig, slidingWindow } from "@heliosjs/core";

// Set before starting server
setRateLimitConfig({
  strategy: slidingWindow(),
  keyGen: (req) => req.getClientIp(),
});
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
