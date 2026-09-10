---
sidebar_position: 8
---

# WebSocket

HeliosJS provides decorator-driven WebSocket support with topic pub/sub, broadcasting, and client management.

## Enable WebSockets

```typescript
import { Server } from "@heliosjs/http";

@Server({
  controllers: [SocketController],
  websocket: { path: "/ws" },
})
export class App {}
```

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
import {
  OnConnection,
  OnMessage,
  OnClose,
  OnError,
  Subscribe,
  InjectWS,
  IWebSocketService,
} from "@heliosjs/http";

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

```typescript
import { Controller } from "@heliosjs/core";
import {
  Subscribe,
  OnMessage,
  InjectWS,
  IWebSocketService,
} from "@heliosjs/http";

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
  handleBroadcast(event: WebSocketEvent, @InjectWS() ws: IWebSocketService) {
    // Publish to a topic - all subscribers receive it
    ws.publishToTopic("announcements", {
      type: "announcement",
      data: { message: event.message?.data },
    });
  }
}
```

## InjectWS - Service Injection

Use `@InjectWS()` to access the WebSocket service programmatically:

```typescript
import { Controller, Post, Body, Param } from "@heliosjs/core";
import { InjectWS, IWebSocketService } from "@heliosjs/http";

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
    @Param("clientId") clientId: string,
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
    @Param("topic") topic: string,
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
import {
  OnConnection,
  OnMessage,
  OnClose,
  Subscribe,
  InjectWS,
  IWebSocketService,
  WebSocketEvent,
} from "@heliosjs/http";

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
  joinRoom(event: WebSocketEvent, @InjectWS() ws: IWebSocketService) {
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
  leaveRoom(event: WebSocketEvent, @InjectWS() ws: IWebSocketService) {
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
