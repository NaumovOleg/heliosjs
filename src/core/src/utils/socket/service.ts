import type { IWebSocketService } from '../../types/ws';
import type { WebSocketServer } from './server';

/**
 * Singleton access layer for WebSocket runtime operations.
 *
 * This service safely proxies calls to the initialized WebSocket server instance.
 */
export class WebSocketService implements IWebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;

  /**
   * Returns singleton service instance.
   */
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Binds an initialized WebSocket server instance to this service.
   *
   * @param wss - WebSocket server runtime.
   */
  initialize(wss: WebSocketServer) {
    this.wss = wss;
  }

  /**
   * Sends payload to a specific client.
   *
   * @param clientId - Target client id.
   * @param message - Serializable payload.
   * @returns `true` when sent successfully.
   */
  sendToClient(clientId: string, message: unknown): boolean {
    if (!this.wss) return false;
    return this.wss.sendToClient(clientId, message);
  }

  /**
   * Publishes payload to a topic.
   *
   * @param topic - Topic name.
   * @param data - Topic payload.
   * @param exclude - Optional client ids to skip.
   */
  publishToTopic(topic: string, data: unknown, exclude?: string[]) {
    if (!this.wss) return;
    this.wss.publishToTopic(topic, data, exclude);
  }

  /**
   * Broadcasts payload to all connected clients.
   *
   * @param message - Payload to broadcast.
   * @param excludeClientId - Optional client id to skip.
   */
  broadcast(message: unknown, excludeClientId?: string) {
    if (!this.wss) return;
    this.wss.broadcast(message, excludeClientId);
  }

  /**
   * Returns current WebSocket connection and subscription statistics.
   */
  getStats() {
    if (!this.wss) return { clients: 0, topics: [] };
    return this.wss.getStats();
  }

  /**
   * Indicates whether a WebSocket server has been initialized.
   */
  isAvailable(): boolean {
    return this.wss !== null;
  }
}
