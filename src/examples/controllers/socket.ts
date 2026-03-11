import { Controller, WebSocketEvent } from 'quantum-flow/core';
import { OnConnection, OnMessage, Subscribe } from 'quantum-flow/ws';

@Controller('socket')
export class Socket {
  @OnConnection()
  aaa(event: WebSocketEvent) {
    console.log('onConnection', event.message);
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
    console.log('ping', event.message);
    event.client.socket.send(JSON.stringify({ type: 'ping', data: { time: Date.now() } }));
  }
  @OnMessage('chat')
  onChat(event: WebSocketEvent) {
    console.log('chat', event.message);
    event.client.socket.send(JSON.stringify({ type: 'onChat', data: { time: Date.now() } }));
  }
}
