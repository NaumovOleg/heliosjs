---
sidebar_position: 9
---

# Server-Sent Events (SSE)

SSE pushes real-time updates from server to client over HTTP. Unlike WebSocket, SSE is unidirectional (server → client) and works over standard HTTP.

## Enable SSE

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [NotificationController],
  sse: { enabled: true },
})
export class App {}
```

## Decorators

| Decorator | Description |
|-----------|-------------|
| `@OnSSEConnection()` | Handle new SSE connections |
| `@OnSSEClose()` | Handle connection close |
| `@OnSSEError()` | Handle SSE errors |
| `@InjectSSE()` | Inject the SSE service |

## Two Kinds of SSE Handler

SSE has two distinct kinds of method, and it's important not to mix them up:

- A regular **HTTP route** (`@Get`) is where a connection is actually
  **established** — the client calls it, and inside it you call
  `sse.createConnection(res)`. This goes through normal parameter resolution,
  so `@Req()` / `@Res()` / `@InjectSSE()` all work here.
- `@OnSSEConnection()` / `@OnSSEClose()` / `@OnSSEError()` are **lifecycle
  callbacks** that fire for *every* connection created anywhere, however it
  was created. They're always called with a single `event: SSEEvent`
  argument — parameter decorators don't apply to them, and returning a value
  from one does nothing (there's no request/response cycle to return into).

## Basic SSE Controller

```typescript
import { Controller, Get, Req, Res } from "@heliosjs/core";
import type { Request, Response, ISSEService } from "@heliosjs/core";
import type { SSEEvent } from "@heliosjs/core/types";
import { OnSSEConnection, OnSSEClose, OnSSEError, InjectSSE } from "@heliosjs/http";

@Controller("events")
export class EventsController {
  // Establishes the connection — the client does `new EventSource('/events/subscribe')`
  @Get("/subscribe")
  subscribe(@Req() req: Request, @Res() res: Response, @InjectSSE() sse: ISSEService) {
    const client = sse.createConnection(res);
    sse.sendToClient(client.id, {
      event: "welcome",
      data: { clientId: client.id, message: "Connected to SSE" },
    });
  }

  // Fires for every connection, from any route that calls createConnection()
  @OnSSEConnection()
  onConnect(event: SSEEvent) {
    console.log(`SSE client ${event.client.id} connected`);
  }

  @OnSSEClose()
  onClose(event: SSEEvent) {
    console.log(`SSE client ${event.client.id} disconnected`);
  }

  @OnSSEError()
  onError(event: SSEEvent) {
    console.error("SSE error:", event.data);
  }
}
```

## Sending Events to Clients

```typescript
import { Controller, Post, Body, Params } from "@heliosjs/core";
import type { ISSEService } from "@heliosjs/core";
import { InjectSSE } from "@heliosjs/http";

@Controller("notifications")
export class NotificationController {
  @Post("/send/:clientId")
  sendToClient(
    @Params("clientId") clientId: string,
    @Body() data: { message: string },
    @InjectSSE() sse: ISSEService,
  ) {
    sse.sendToClient(clientId, {
      event: "notification",
      data: data.message,
    });
    return { sent: true };
  }

  @Post("/broadcast")
  broadcast(
    @Body() data: { message: string },
    @InjectSSE() sse: ISSEService,
  ) {
    sse.broadcast({
      event: "announcement",
      data: data.message,
    });
    return { sent: true };
  }

  @Post("/stats")
  stats(@InjectSSE() sse: ISSEService) {
    return sse.getStats();
  }
}
```

## Real-Time Stock Price Example

```typescript
import { Controller, Get, Req, Res } from "@heliosjs/core";
import type { ISSEService } from "@heliosjs/core";
import { InjectSSE } from "@heliosjs/http";

@Controller("stocks")
export class StockController {
  private intervals = new Map<string, NodeJS.Timeout>();

  @Get("/subscribe")
  subscribe(@Req() req: any, @Res() res: any, @InjectSSE() sse: ISSEService) {
    const client = sse.createConnection(res);

    // Simulate stock price updates every 2 seconds
    const interval = setInterval(() => {
      const price = 100 + Math.random() * 50;
      sse.sendToClient(client.id, {
        event: "price-update",
        data: {
          symbol: "HELIOS",
          price: price.toFixed(2),
          timestamp: new Date().toISOString(),
        },
      });
    }, 2000);

    this.intervals.set(client.id, interval);

    // Clean up on disconnect — req/res are framework wrappers; the raw Node
    // request (an EventEmitter) is available via req.raw.
    req.raw.on("close", () => {
      clearInterval(this.intervals.get(client.id)!);
      this.intervals.delete(client.id);
    });
  }
}
```

## Event Format

SSE events follow the standard format:

```
event: notification
data: {"message":"Hello!"}

event: price-update
data: {"symbol":"HELIOS","price":"123.45"}

event: heartbeat
data: {"time":"2024-01-15T10:30:00Z"}
```

## Client-Side Usage

```javascript
const eventSource = new EventSource("http://localhost:3000/events/subscribe");

eventSource.addEventListener("notification", (event) => {
  const data = JSON.parse(event.data);
  console.log("Notification:", data);
});

eventSource.addEventListener("price-update", (event) => {
  const data = JSON.parse(event.data);
  console.log(`Price: $${data.price}`);
});

eventSource.onerror = (error) => {
  console.error("SSE error:", error);
};
```

## SSE vs WebSocket

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Protocol | HTTP | WS/WSS |
| Auto-reconnect | Built-in | Manual |
| Browser support | All modern | All modern |
| Use case | Notifications, feeds | Chat, gaming |

## Remarks

- SSE uses standard HTTP, so it works through proxies and load balancers
- The browser auto-reconnects on connection loss
- `@InjectSSE()` gives access to the SSE service for programmatic control
- `broadcast()` sends to all connected clients
- `sendToClient()` sends to a specific client by ID
- Clean up intervals/listeners on disconnect to prevent memory leaks
