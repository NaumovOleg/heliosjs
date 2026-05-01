// server/SSEServer.ts
import { ServerResponse } from 'node:http';
import { SSE_HASH } from '../../constants';
import { ControllerType, ISSEServer, SSEClient, SSEEvent, SSEMessage } from '../../types/core';
import { generateUniqueId } from '../shared';
export class SSEServer implements ISSEServer {
  private readonly clients: Map<string, SSEClient> = new Map();
  controllers: any[] = [];

  public createConnection(res: ServerResponse): SSEClient {
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

    this.triggerHandlers('connection', {
      type: 'connection',
      client,
      data: res,
    });

    res.on('close', () => {
      this.clients.delete(clientId);
      this.triggerHandlers('close', { type: 'close', client });
    });

    return client;
  }

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

      dataStr.split('\n').forEach(line => {
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

  public broadcast(message: SSEMessage, excludeClientId?: string) {
    this.clients.forEach((_, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  public getStats() {
    return { clients: this.clients.size };
  }

  registerControllers(controllers: ControllerType[]) {
    this.controllers = controllers.filter(c => c.sse);
  }

  private async triggerHandlers(eventType: string, event: SSEEvent) {
    for (const controller of this.controllers) {
      if (controller[SSE_HASH].handlers && controller[SSE_HASH].handlers[eventType]) {
        for (const handler of controller[SSE_HASH].handlers[eventType]) {
          await handler.fn(event).catch(console.error);
        }
      }
    }
  }
}
