import type http from 'node:http';
import type { Duplex } from 'node:stream';
import type WebSocket from 'ws';
import { WebSocketServer as Server } from 'ws';
import type { ControllerType } from '../../types/core';
import type {
  IWebSocketServer,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
  WebSocketServerOptions,
} from '../../types/ws';
import { getGlobalLogger } from '../core/logger';
import { generateUniqueId } from '../shared';

/**
 * @internal Low-level WebSocket server bound to a Node HTTP server; handles the
 * upgrade handshake, client tracking, topic pub-sub, and dispatch to
 * `@OnWS`/`@Subscribe` handlers on registered controllers. Constructed by the
 * `@heliosjs/http` `Helios` adapter when `websocket` is configured. App code
 * should use `WebSocketService.getInstance()` (or `@InjectWS()`) instead of this
 * class directly.
 */
export class WebSocketServer implements IWebSocketServer {
  wss: Server;
  private readonly clients = new Map<string, WebSocketClient>();
  private readonly topics = new Map<string, Set<string>>();
  private readonly messageWindows = new Map<string, { startedAt: number; count: number }>();
  private controllers: ControllerType[] = [];
  private readonly options: Required<
    Pick<
      WebSocketServerOptions,
      | 'path'
      | 'maxPayload'
      | 'maxConnections'
      | 'maxMessagesPerMinute'
      | 'maxBufferedAmount'
      | 'allowClientSubscriptions'
      | 'allowClientPublish'
    >
  > & Omit<WebSocketServerOptions, 'path'>;

  /**
   * Creates low-level WebSocket server bound to an existing HTTP server.
   *
   * @param server - Parent HTTP server instance.
   * @param options - WebSocket options including endpoint path.
   */
  constructor(server: http.Server, options?: Partial<WebSocketServerOptions>) {
    validateWebSocketLimit(options?.maxPayload, 'maxPayload', false);
    validateWebSocketLimit(options?.maxConnections, 'maxConnections', true);
    validateWebSocketLimit(options?.maxMessagesPerMinute, 'maxMessagesPerMinute', true);
    validateWebSocketLimit(options?.maxBufferedAmount, 'maxBufferedAmount', true);
    this.options = {
      path: options?.path ?? '/ws',
      maxPayload: options?.maxPayload ?? 1024 * 1024,
      maxConnections: options?.maxConnections ?? 1000,
      maxMessagesPerMinute: options?.maxMessagesPerMinute ?? 120,
      maxBufferedAmount: options?.maxBufferedAmount ?? 8 * 1024 * 1024,
      allowClientSubscriptions: options?.allowClientSubscriptions ?? false,
      allowClientPublish: options?.allowClientPublish ?? false,
      ...options,
    };

    this.wss = new Server({
      noServer: true,
      path: this.options.path,
      maxPayload: this.options.maxPayload,
    });

    this.wss.on('connection', (socket) => this.handleConnection(socket));

    server.on('upgrade', (request, socket, head) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((socket as any).__wsHandled) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).__wsHandled = true;

      this.handleUpgrade(request, socket, head);
    });
  }

  private shouldHandleWebSocket(url = ''): boolean {
    try {
      const pathname = new URL(url, 'http://localhost').pathname;
      const normalize = (value: string) =>
        value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
      return normalize(pathname) === normalize(this.options.path);
    } catch {
      return false;
    }
  }

  private handleUpgrade(
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (!this.shouldHandleWebSocket(request.url)) {
      socket.destroy();
      return;
    }

    if (this.clients.size >= this.options.maxConnections) {
      this.rejectUpgrade(socket, 503, 'WebSocket connection limit reached');
      return;
    }

    const origin = request.headers?.origin;
    if (!origin && !this.options.authenticate) {
      this.acceptUpgrade(request, socket, head);
      return;
    }

    void this.authorizeUpgrade(request, socket, head, origin).catch(() => {
      this.rejectUpgrade(socket, 401, 'WebSocket authentication required');
    });
  }

  private async authorizeUpgrade(
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    origin?: string,
  ): Promise<void> {
    if (origin && !(await this.isOriginAllowed(origin, request))) {
      this.rejectUpgrade(socket, 403, 'WebSocket origin not allowed');
      return;
    }
    if (this.options.authenticate && !(await this.options.authenticate(request))) {
      this.rejectUpgrade(socket, 401, 'WebSocket authentication required');
      return;
    }
    this.acceptUpgrade(request, socket, head);
  }

  private acceptUpgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  private async isOriginAllowed(
    origin: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    const policy = this.options.allowedOrigins;
    if (!policy) return this.isSameOrigin(origin, request);
    if (Array.isArray(policy)) return policy.includes(origin);
    return policy(origin);
  }

  /**
   * Without an explicit origin policy, browser handshakes are accepted only
   * when the `Origin` authority matches the request `Host` (same-origin).
   * Requests without `Origin` never reach this method.
   */
  private isSameOrigin(origin: string, request: http.IncomingMessage): boolean {
    const host = request.headers?.host;
    if (!host) return false;
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }

  private rejectUpgrade(socket: Duplex, status: number, message: string) {
    if (!socket.destroyed && typeof socket.write === 'function') {
      socket.write(
        `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
    }
    socket.destroy();
  }

  private async handleConnection(socket: WebSocket) {
    if (this.clients.size >= this.options.maxConnections) {
      socket.close(1008, 'Connection limit reached');
      return;
    }

    const clientId = generateUniqueId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      topics: new Set(),
      data: {},
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);
    this.messageWindows.set(clientId, { startedAt: Date.now(), count: 0 });

    socket.on('message', (data: WebSocket.Data) => {
      void this.handleMessage(client, data);
    });

    socket.on('close', () => this.handleClose(client));

    socket.on('error', (error: Error) => this.handleError(client, error));

    await this.triggerHandlers('connection', { type: 'connection', client });
  }

  private async handleMessage(client: WebSocketClient, data: WebSocket.Data) {
    try {
      if (!this.consumeMessageBudget(client.id)) {
        this.sendJson(client.socket, { type: 'error', data: { message: 'Rate limit exceeded' } });
        return;
      }

      const message = JSON.parse(data.toString()) as WebSocketMessage;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        throw new Error('Invalid WebSocket message');
      }
      const topic = message.topic ?? message.data?.topic;

      if (topic !== undefined && (typeof topic !== 'string' || !this.isValidTopic(topic))) {
        throw new Error('Invalid topic');
      }

      if (message.type === 'subscribe' && topic) {
        if (!(await this.canAccessTopic(client, topic, 'subscribe'))) {
          this.sendJson(client.socket, { type: 'error', data: { message: 'Not authorized' } });
          return;
        }
        this.subscribeToTopic(client, topic);
        return;
      }

      if (message.type === 'unsubscribe' && message.topic) {
        this.unsubscribeFromTopic(client, message.topic);
        return;
      }

      if (message.type === 'topic_message' && message.topic) {
        if (!(await this.canAccessTopic(client, message.topic, 'publish'))) {
          this.sendJson(client.socket, { type: 'error', data: { message: 'Not authorized' } });
          return;
        }
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
    } catch {
      // Never echo parser/handler exception text over an untrusted socket.
      this.sendJson(client.socket, {
        type: 'error',
        data: { message: 'Invalid WebSocket message' },
      });
    }
  }

  private consumeMessageBudget(clientId: string): boolean {
    const now = Date.now();
    const window = this.messageWindows.get(clientId) ?? { startedAt: now, count: 0 };
    if (now - window.startedAt >= 60_000) {
      window.startedAt = now;
      window.count = 0;
    }
    window.count += 1;
    this.messageWindows.set(clientId, window);
    return window.count <= this.options.maxMessagesPerMinute;
  }

  private isValidTopic(topic: string): boolean {
    return (
      topic.length > 0 &&
      topic.length <= 128 &&
      !topic.includes(String.fromCharCode(0)) &&
      !topic.includes('\r') &&
      !topic.includes('\n')
    );
  }

  private async canAccessTopic(
    client: WebSocketClient,
    topic: string,
    action: 'subscribe' | 'publish',
  ): Promise<boolean> {
    if (this.options.authorizeTopic) {
      return this.options.authorizeTopic(client, topic, action);
    }
    return action === 'subscribe'
      ? this.options.allowClientSubscriptions
      : this.options.allowClientPublish;
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
    this.messageWindows.delete(client.id);

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
          getGlobalLogger().error(`ws: handler ${handler.method} failed`, error);
        }
      }

      if (eventType === 'message' && topic) {
        const matchingSubs = controller.websocket?.topics.filter((s) => s.topic === topic) ?? [];

        for (const sub of matchingSubs) {
          try {
            await sub.fn(event);
          } catch (error) {
            getGlobalLogger().error(`ws: subscription ${sub.method} failed`, error);
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

    this.sendJson(client.socket, { type: 'subscribed', topic, data: { success: true } });
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

    this.sendJson(client.socket, {
      type: 'unsubscribed',
      topic,
      data: { success: true },
    });
  }

  /**
   * Publishes message payload to topic subscribers.
   *
   * @param topic - Topic name.
   * @param data - Message payload.
   * @param exclude - Optional client ids to skip.
   */
  public publishToTopic(topic: string, data: unknown, exclude?: string[]) {
    if (!this.isValidTopic(topic)) return;
    const topicClients = this.topics.get(topic);
    if (!topicClients) return;

    topicClients.forEach((clientId) => {
      if (exclude?.includes(clientId)) {
        return;
      }

      const client = this.clients.get(clientId);
      if (client) {
        this.sendJson(client.socket, {
          type: 'message',
          topic,
          data,
          timestamp: new Date().toISOString(),
        });
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
      return this.sendJson(client.socket, message);
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
        this.sendJson(client.socket, messageStr);
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

  private sendJson(socket: WebSocket, message: unknown): boolean {
    if (typeof socket.readyState === 'number' && socket.readyState !== 1) return false;
    if (
      typeof socket.bufferedAmount === 'number' &&
      socket.bufferedAmount > this.options.maxBufferedAmount
    ) {
      socket.close(1009, 'Slow consumer');
      return false;
    }
    try {
      socket.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }
}

function validateWebSocketLimit(value: number | undefined, name: string, allowZero: boolean): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || !Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new TypeError(`WebSocket ${name} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  }
}
