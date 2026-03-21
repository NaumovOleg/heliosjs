import { Controller } from '@heliosjs/core';
import { OnConnection, OnMessage, Subscribe, WebSocketEvent } from '@heliosjs/http';

@Controller('socket')
export class Socket {
  @OnConnection()
  onconnect(event: WebSocketEvent) {
    event.client.socket.send(JSON.stringify({ type: 'welcome', data: { message: 'welcome' } }));
  }

  @Subscribe('chat')
  sunbcription(event: WebSocketEvent) {
    const msg = event.message?.data;
    if (msg?.text.includes('bad')) {
      return;
    }
  }

  @OnMessage('ping')
  onPing(event: WebSocketEvent) {
    event.client.socket.send(JSON.stringify({ type: 'ping', data: { time: Date.now() } }));
  }
  @OnMessage('chat')
  onChat(event: WebSocketEvent) {
    event.client.socket.send(JSON.stringify({ type: 'onChat', data: { time: Date.now() } }));
  }
}
