---
sidebar_position: 8
---

# WebSocket

HeliosJS provides decorator-driven WebSocket support with topic pub/sub, broadcasting, and client management.

## Enable WebSockets

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [ChatController],
  websocket: { path: "/ws", controllers: [ChatController] },
})
export class App {}
```

:::note
`websocket.controllers` is **required** and separate from the top-level
`controllers` — it's the list the WebSocket server scans for `@OnWS` /
`@OnMessage` / `@Subscribe` handlers. A controller left out of it will never
receive WebSocket events, even if it's already in `controllers` for regular
HTTP routes.
:::

## Decorators

| Decorator | Description |
|-----------|-------------|
| `@OnConnection()` | Handle new client connections |
| `@OnMessage(topic?)` | Handle messages of a specific type |
| `@OnClose()` | Handle client disconnections |
| `@OnError()` | Handle WebSocket errors |
| `@Subscribe(topic)` | Subscribe to a named topic |
| `@InjectWS()` | Inject the WebSocket service |

## Basic WebSocket Controller

```typescript
import { Controller } from "@heliosjs/core";
import type { WebSocketEvent } from "@heliosjs/core";
import { OnConnection, OnMessage, OnClose, OnError } from "@heliosjs/http";

@Controller("chat")
export class ChatController {
  @OnConnection()
  onConnect(event: WebSocketEvent) {
    event.client.socket.send(
      JSON.stringify({ type: "welcome", data: { clientId: event.client.id } }),
    );
  }

  @OnMessage("chat")
  onChat(event: WebSocketEvent) {
    // Echo back to sender
    event.client.socket.send(
      JSON.stringify({ type: "chat", data: { time: Date.now() } }),
    );
  }

  @OnMessage("ping")
  onPing(event: WebSocketEvent) {
    event.client.socket.send(
      JSON.stringify({ type: "pong", data: { time: Date.now() } }),
    );
  }

  @OnClose()
  onClose(event: WebSocketEvent) {
    console.log(`Client ${event.client.id} disconnected`);
  }

  @OnError()
  onError(event: WebSocketEvent) {
    console.error("WebSocket error:", event.data);
  }
}
```

## Topic Pub/Sub

Subscribe to topics and broadcast messages:

:::note
`@OnWS`/`@OnMessage`/`@Subscribe` handlers are lifecycle callbacks, not HTTP
routes — they're always called with a single `event` argument, so parameter
decorators like `@InjectWS()` don't apply inside them. To reach the WebSocket
service from one of these handlers, call `WebSocketService.getInstance()`
directly instead.
:::

```typescript
import { Controller } from "@heliosjs/core";
import type { WebSocketEvent } from "@heliosjs/core";
import { WebSocketService } from "@heliosjs/core/utils";
import { Subscribe, OnMessage } from "@heliosjs/http";

@Controller("notifications")
export class NotificationController {
  @Subscribe("announcements")
  onAnnouncement(event: WebSocketEvent) {
    // This method runs when a message is published to "announcements"
    console.log("New announcement:", event.message?.data);
  }

  @Subscribe("user-updates")
  onUserUpdate(event: WebSocketEvent) {
    console.log("User update:", event.message?.data);
  }

  @OnMessage("broadcast")
  handleBroadcast(event: WebSocketEvent) {
    // Publish to a topic - all subscribers receive it
    WebSocketService.getInstance().publishToTopic("announcements", {
      type: "announcement",
      data: { message: event.message?.data },
    });
  }
}
```

## InjectWS - Service Injection

`@InjectWS()` works on regular HTTP route handlers (unlike the lifecycle
handlers above, these go through normal parameter resolution) — use it to
push WebSocket messages as a side effect of a REST call:

```typescript
import { Controller, Post, Body, Params } from "@heliosjs/core";
import type { IWebSocketService } from "@heliosjs/core";
import { InjectWS } from "@heliosjs/http";

@Controller("admin")
export class AdminController {
  @Post("/announce")
  announce(
    @Body() data: { message: string },
    @InjectWS() ws: IWebSocketService,
  ) {
    // Broadcast to all connected clients
    ws.broadcast({
      type: "announcement",
      data: data.message,
    });
    return { sent: true };
  }

  @Post("/notify/:clientId")
  notify(
    @Params("clientId") clientId: string,
    @Body() data: { message: string },
    @InjectWS() ws: IWebSocketService,
  ) {
    // Send to specific client
    ws.sendToClient(clientId, {
      type: "notification",
      data: data.message,
    });
    return { sent: true };
  }

  @Post("/topic/:topic")
  publishToTopic(
    @Params("topic") topic: string,
    @Body() data: any,
    @InjectWS() ws: IWebSocketService,
  ) {
    // Publish to a topic
    ws.publishToTopic(topic, {
      type: topic,
      data,
    });
    return { sent: true };
  }

  @Post("/stats")
  stats(@InjectWS() ws: IWebSocketService) {
    return ws.getStats();
  }
}
```

## Chat Room Example

A complete chat room with rooms and broadcasting:

```typescript
import { Controller } from "@heliosjs/core";
import type { WebSocketEvent } from "@heliosjs/core";
import { OnConnection, OnMessage, OnClose, Subscribe } from "@heliosjs/http";

@Controller("chatroom")
export class ChatRoomController {
  @OnConnection()
  onConnect(event: WebSocketEvent) {
    event.client.socket.send(
      JSON.stringify({
        type: "welcome",
        data: {
          clientId: event.client.id,
          message: "Connected to chat room",
        },
      }),
    );
  }

  @Subscribe("room-general")
  onGeneralRoom(event: WebSocketEvent) {
    // Handle messages in "room-general" topic
    console.log(`[${event.client.id}] general:`, event.message?.data);
  }

  @Subscribe("room-random")
  onRandomRoom(event: WebSocketEvent) {
    // Handle messages in "room-random" topic
    console.log(`[${event.client.id}] random:`, event.message?.data);
  }

  @OnMessage("join-room")
  joinRoom(event: WebSocketEvent) {
    const roomName = event.message?.data?.room;
    if (roomName) {
      // Client auto-subscribes via @Subscribe decorators
      event.client.socket.send(
        JSON.stringify({
          type: "room-joined",
          data: { room: roomName },
        }),
      );
    }
  }

  @OnMessage("leave-room")
  leaveRoom(event: WebSocketEvent) {
    const roomName = event.message?.data?.room;
    event.client.socket.send(
      JSON.stringify({
        type: "room-left",
        data: { room: roomName },
      }),
    );
  }

  @OnClose()
  onClose(event: WebSocketEvent) {
    console.log(`Client ${event.client.id} left chat`);
  }
}
```

## Client-Side Usage

```javascript
const ws = new WebSocket("ws://localhost:3000/ws");

ws.onopen = () => {
  // Join a room
  ws.send(JSON.stringify({
    type: "join-room",
    data: { room: "general" },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.data);
};

// Send a chat message
ws.send(JSON.stringify({
  type: "chat",
  data: { text: "Hello everyone!" },
}));
```

## Message Format

All WebSocket messages use this structure:

```typescript
interface WebSocketMessage {
  type: string;    // Message type (e.g., "chat", "ping", "join-room")
  topic?: string;  // Optional topic for pub/sub
  data?: any;      // Payload
  clientId?: string;
}
```

## Remarks

- WebSocket controllers use the same `@Controller` decorator as HTTP
- `@Subscribe` registers handlers for specific topics
- `@InjectWS()` gives access to the WebSocket service for programmatic control
- Messages are JSON-serialized automatically
- `getStats()` returns connected client count and topic subscriptions
