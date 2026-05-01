import http from 'node:http';
import WebSocket, { WebSocketServer as Server } from 'ws';
import { WS_HASH } from '../../constants';
import { ControllerType } from '../../types/core';
import {
  IWebSocketServer,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '../../types/ws';
import { generateUniqueId } from '../shared';

export class WebSocketServer implements IWebSocketServer {
  wss: Server;
  private readonly clients: Map<string, WebSocketClient> = new Map();
  private readonly topics: Map<string, Set<string>> = new Map();
  private controllers: ControllerType[] = [];
  private readonly options: any;

  constructor(server: http.Server, options?: { path: string }) {
    this.options = options;

    this.wss = new Server({
      noServer: true,
      path: this.options.path,
    });

    this.wss.on('connection', socket => {
      this.handleConnection(socket);
    });

    server.on('upgrade', (request, socket, head) => {
      if ((socket as any).__wsHandled) {
        return;
      }
      (socket as any).__wsHandled = true;

      if (this.shouldHandleWebSocket(request.url)) {
        this.wss.handleUpgrade(request, socket, head, ws => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private shouldHandleWebSocket(url: string = ''): boolean {
    return url.startsWith(this.options.path);
  }

  private async handleConnection(socket: WebSocket) {
    const clientId = generateUniqueId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      topics: new Set(),
      data: {},
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    socket.on('message', (data: WebSocket.Data) => {
      this.handleMessage(client, data);
    });

    socket.on('close', () => {
      this.handleClose(client);
    });

    socket.on('error', (error: Error) => {
      this.handleError(client, error);
    });

    await this.triggerHandlers('connection', { type: 'connection', client });
  }

  private async handleMessage(client: WebSocketClient, data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const topic = message.topic ?? message.data?.topic;

      if (message.type === 'subscribe' && topic) {
        this.subscribeToTopic(client, topic);
        return;
      }

      if (message.type === 'unsubscribe' && message.topic) {
        this.unsubscribeFromTopic(client, message.topic);
        return;
      }

      if (message.type === 'topic_message' && message.topic) {
        await this.triggerHandlers(
          'message',
          {
            type: 'message',
            client,
            message,
          },
          message.topic,
        );

        this.publishToTopic(message.topic, message.data, [client.id]);
        return;
      }

      await this.triggerHandlers('message', {
        type: 'message',
        client,
        message,
      });
    } catch (_: unknown) {
      client.socket.send(
        JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }),
      );
    }
  }

  private async handleClose(client: WebSocketClient) {
    client.topics.forEach(topic => {
      const topicClients = this.topics.get(topic);
      if (topicClients) {
        topicClients.delete(client.id);
        if (topicClients.size === 0) {
          this.topics.delete(topic);
        }
      }
    });

    this.clients.delete(client.id);

    await this.triggerHandlers('close', {
      type: 'close',
      client,
    });
  }

  private async handleError(client: WebSocketClient, error: Error) {
    await this.triggerHandlers('error', {
      type: 'error',
      client,
      data: error,
    });
  }

  private async triggerHandlers(
    eventType: 'connection' | 'message' | 'close' | 'error',
    event: WebSocketEvent,
    topic?: string,
  ) {
    for (const controller of this.controllers) {
      const controllerHandlers = controller[WS_HASH]?.handlers?.[eventType] ?? [];
      const matchingHandlers = controllerHandlers.filter(h => {
        if (h.type !== eventType) return false;
        if (!topic) return !h.topic;
        return !h.topic || h.topic === topic;
      });

      for (const handler of matchingHandlers) {
        try {
          await handler.fn(event);
        } catch (error) {
          console.error(`Error in WebSocket handler ${handler.method}:`, error);
        }
      }

      if (eventType === 'message' && topic) {
        const matchingSubs = controller[WS_HASH]?.topics.filter(s => s.topic === topic) ?? [];

        for (const sub of matchingSubs) {
          try {
            await sub.fn(event);
          } catch (error) {
            console.error(`Error in subscription ${sub.method}:`, error);
          }
        }
      }
    }
  }

  public registerControllers(controllers: ControllerType[]) {
    this.controllers = controllers.filter(c => !!c[WS_HASH]);
  }

  public subscribeToTopic(client: WebSocketClient, topic: string) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }

    this.topics.get(topic)!.add(client.id);
    client.topics.add(topic);

    client.socket.send(JSON.stringify({ type: 'subscribed', topic, data: { success: true } }));
  }

  public unsubscribeFromTopic(client: WebSocketClient, topic: string) {
    const topicClients = this.topics.get(topic);
    if (topicClients) {
      topicClients.delete(client.id);
      if (topicClients.size === 0) {
        this.topics.delete(topic);
      }
    }
    client.topics.delete(topic);

    client.socket.send(
      JSON.stringify({
        type: 'unsubscribed',
        topic,
        data: { success: true },
      }),
    );
  }

  public publishToTopic(topic: string, data: unknown, exclude?: string[]) {
    const topicClients = this.topics.get(topic);
    if (!topicClients) return;

    const message = JSON.stringify({
      type: 'message',
      topic,
      data,
      timestamp: new Date().toISOString(),
    });

    topicClients.forEach(clientId => {
      if (exclude && exclude.includes(clientId)) {
        return;
      }

      const client = this.clients.get(clientId);
      if (client) {
        client.socket.send(message);
      }
    });
  }

  public sendToClient(clientId: string, message: unknown): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public broadcast(message: unknown, excludeClientId?: string) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        client.socket.send(messageStr);
      }
    });
  }

  public getStats() {
    return {
      clients: this.clients.size,
      topics: Array.from(this.topics.entries()).map(([topic, clients]) => ({
        topic,
        subscribers: clients.size,
      })),
    };
  }
}
