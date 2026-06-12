import type http from 'node:http';
import type WebSocket from 'ws';
import { WebSocketServer as Server } from 'ws';
import type { ControllerType } from '../../types/core';
import type {
  IWebSocketServer,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '../../types/ws';
import { generateUniqueId } from '../shared';

export class WebSocketServer implements IWebSocketServer {
  wss: Server;
  private readonly clients = new Map<string, WebSocketClient>();
  private readonly topics = new Map<string, Set<string>>();
  private controllers: ControllerType[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly options: any;

  /**
   * Creates low-level WebSocket server bound to an existing HTTP server.
   *
   * @param server - Parent HTTP server instance.
   * @param options - WebSocket options including endpoint path.
   */
  constructor(server: http.Server, options?: { path: string }) {
    this.options = options;

    this.wss = new Server({
      noServer: true,
      path: this.options.path,
    });

    this.wss.on('connection', (socket) => this.handleConnection(socket));

    server.on('upgrade', (request, socket, head) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((socket as any).__wsHandled) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).__wsHandled = true;

      if (this.shouldHandleWebSocket(request.url)) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private shouldHandleWebSocket(url = ''): boolean {
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

    socket.on('message', (data: WebSocket.Data) => this.handleMessage(client, data));

    socket.on('close', () => this.handleClose(client));

    socket.on('error', (error: Error) => this.handleError(client, error));

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
          message.topic
        );

        this.publishToTopic(message.topic, message.data, [client.id]);
        return;
      }

      await this.triggerHandlers('message', {
        type: 'message',
        client,
        message,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      client.socket.send(JSON.stringify({ type: 'error', data: { message: error.message } }));
    }
  }

  private async handleClose(client: WebSocketClient) {
    client.topics.forEach((topic) => {
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
    topic?: string
  ) {
    for (const controller of this.controllers) {
      const controllerHandlers = controller.websocket?.handlers?.[eventType] ?? [];
      const matchingHandlers = controllerHandlers.filter((h) => {
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
        const matchingSubs = controller.websocket?.topics.filter((s) => s.topic === topic) ?? [];

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

  /**
   * Registers controller instances with WebSocket metadata.
   *
   * @param controllers - Controller instances to scan for WS handlers/topics.
   */
  public registerControllers(controllers: ControllerType[]) {
    this.controllers = controllers.filter((c) => !!c.websocket);
  }

  /**
   * Subscribes a client to a topic.
   *
   * @param client - Connected WebSocket client.
   * @param topic - Topic name.
   */
  public subscribeToTopic(client: WebSocketClient, topic: string) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }

    this.topics.get(topic)?.add(client.id);
    client.topics.add(topic);

    client.socket.send(JSON.stringify({ type: 'subscribed', topic, data: { success: true } }));
  }

  /**
   * Removes topic subscription for a client.
   *
   * @param client - Connected WebSocket client.
   * @param topic - Topic name.
   */
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
      })
    );
  }

  /**
   * Publishes message payload to topic subscribers.
   *
   * @param topic - Topic name.
   * @param data - Message payload.
   * @param exclude - Optional client ids to skip.
   */
  public publishToTopic(topic: string, data: unknown, exclude?: string[]) {
    const topicClients = this.topics.get(topic);
    if (!topicClients) return;

    const message = JSON.stringify({
      type: 'message',
      topic,
      data,
      timestamp: new Date().toISOString(),
    });

    topicClients.forEach((clientId) => {
      if (exclude?.includes(clientId)) {
        return;
      }

      const client = this.clients.get(clientId);
      if (client) {
        client.socket.send(message);
      }
    });
  }

  /**
   * Sends a direct payload to a specific client.
   *
   * @param clientId - Target client id.
   * @param message - Payload to send.
   * @returns `true` when client is connected and message was sent.
   */
  public sendToClient(clientId: string, message: unknown): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcasts payload to all connected clients.
   *
   * @param message - Broadcast payload.
   * @param excludeClientId - Optional client id to exclude.
   */
  public broadcast(message: unknown, excludeClientId?: string) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        client.socket.send(messageStr);
      }
    });
  }

  /**
   * Returns live server statistics.
   */
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
