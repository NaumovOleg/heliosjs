import type { ServerResponse } from 'node:http';
import type { ISSEService, SSEMessage } from '../../types/core';
import type { SSEServer } from './server';

/**
 * Singleton access layer for SSE runtime operations.
 *
 * This service proxies common SSE actions to the initialized SSE server.
 */
export class SSEService implements ISSEService {
  private static instance: SSEService;
  private sse: SSEServer;

  /**
   * Returns singleton SSE service instance.
   */
  static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  /**
   * Binds initialized SSE server instance.
   *
   * @param sse - SSE server runtime.
   */
  initialize(sse: SSEServer) {
    this.sse = sse;
  }

  /**
   * Sends one SSE message to a specific client.
   *
   * @param clientId - Target client id.
   * @param message - SSE payload.
   * @returns `true` when message was delivered.
   */
  sendToClient(clientId: string, message: SSEMessage): boolean {
    if (!this.sse) return false;
    return this.sse.sendToClient(clientId, message);
  }

  /**
   * Broadcasts SSE message to all connected clients.
   *
   * @param message - SSE payload.
   * @param excludeClientId - Optional client id to skip.
   */
  broadcast(message: SSEMessage, excludeClientId?: string) {
    if (!this.sse) return;
    this.sse.broadcast(message, excludeClientId);
  }

  /**
   * Returns current SSE connection statistics.
   */
  getStats() {
    if (!this.sse) return { clients: 0 };
    return this.sse.getStats();
  }

  /**
   * Indicates whether SSE runtime is initialized.
   */
  isAvailable(): boolean {
    return this.sse !== null;
  }

  /**
   * Creates a new SSE connection from HTTP response stream.
   *
   * @param res - Node.js response object.
   * @returns Connected SSE client descriptor.
   */
  createConnection(res: ServerResponse, origin?: string) {
    return this.sse.createConnection(res, origin);
  }
}
