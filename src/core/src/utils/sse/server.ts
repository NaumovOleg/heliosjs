// server/SSEServer.ts
import type { ServerResponse } from 'node:http';

import type { ControllerType, ISSEServer, SSEClient, SSEEvent, SSEMessage } from '../../types/core';
import { generateUniqueId } from '../shared';

export class SSEServer implements ISSEServer {
  private readonly clients = new Map<string, SSEClient>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers: any[] = [];

  /**
   * Creates and registers a new SSE client connection.
   *
   * @param res - Raw HTTP response used as event stream transport.
   * @returns Registered SSE client descriptor.
   */
  public createConnection(res: ServerResponse) {
    const clientId = generateUniqueId();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(': connected\n\n');

    const client: SSEClient = {
      id: clientId,
      response: res,
      topics: new Set(),
      data: {},
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.triggerHandlers('connection', { type: 'connection', client, data: res });

    res.on('close', async () => {
      this.clients.delete(clientId);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.triggerHandlers('close', { type: 'close', client });
    });

    return client;
  }

  /**
   * Sends a server-sent event payload to a specific client.
   *
   * @param clientId - Target client id.
   * @param message - SSE message fields (`event`, `id`, `retry`, `data`).
   * @returns `true` if message was written successfully.
   */
  public sendToClient(clientId: string, message: SSEMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      let sseMessage = '';
      if (message.event) sseMessage += `event: ${message.event}\n`;
      if (message.id) sseMessage += `id: ${message.id}\n`;
      if (message.retry) sseMessage += `retry: ${message.retry}\n`;

      const dataStr =
        typeof message.data === 'string' ? message.data : JSON.stringify(message.data);

      dataStr.split('\n').forEach((line) => {
        sseMessage += `data: ${line}\n`;
      });
      sseMessage += '\n';

      client.response.write(sseMessage);
      return true;
    } catch (error) {
      console.error(`SSE_HASH send error to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcasts one SSE message to all connected clients.
   *
   * @param message - SSE payload to broadcast.
   * @param excludeClientId - Optional client id to skip.
   */
  public broadcast(message: SSEMessage, excludeClientId?: string) {
    this.clients.forEach((_, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  /**
   * Returns current SSE connection statistics.
   */
  public getStats() {
    return { clients: this.clients.size };
  }

  /**
   * Registers controller instances that define SSE handlers.
   *
   * @param controllers - Controller instances with SSE metadata.
   */
  registerControllers(controllers: ControllerType[]) {
    this.controllers = controllers.filter((c) => c.sse);
  }

  private async triggerHandlers(eventType: string, event: SSEEvent) {
    for (const controller of this.controllers) {
      if (controller.sse?.handlers?.[eventType]) {
        for (const handler of controller.sse.handlers[eventType]) {
          await handler.fn(event).catch(console.error);
        }
      }
    }
  }
}
