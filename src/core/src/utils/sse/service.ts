import type { ServerResponse } from 'node:http';
import type { ISSEService, SSEMessage } from '../../types/core';
import type { SSEServer } from './server';

export class SSEService implements ISSEService {
  private static instance: SSEService;
  private sse: SSEServer;

  static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  initialize(sse: SSEServer) {
    this.sse = sse;
  }

  sendToClient(clientId: string, message: SSEMessage): boolean {
    if (!this.sse) return false;
    return this.sse.sendToClient(clientId, message);
  }

  broadcast(message: SSEMessage, excludeClientId?: string) {
    if (!this.sse) return;
    this.sse.broadcast(message, excludeClientId);
  }

  getStats() {
    if (!this.sse) return { clients: 0 };
    return this.sse.getStats();
  }

  isAvailable(): boolean {
    return this.sse !== null;
  }

  createConnection(res: ServerResponse) {
    return this.sse.createConnection(res);
  }
}
