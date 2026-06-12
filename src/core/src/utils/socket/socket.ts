import type { WebSocketServer } from './server';
import { WebSocketService } from './service';

/**
 * Convenience facade for runtime WebSocket operations.
 *
 * Use this class to register controllers and push messages without coupling
 * to concrete server internals.
 */
export class Socket {
  protected wss!: WebSocketServer;

  /**
   * Registers controller instances that contain WebSocket handlers.
   *
   * @param controllers - Controller instances with websocket metadata.
   * @returns Current socket facade for chaining.
   */
  public registerWebSocketControllers(controllers: any[]) {
    if (!this.wss) {
      console.warn(
        '⚠️ WebSocket is disabled. Enable it in config: { websocket: { enabled: true } }'
      );
      return this;
    }
    this.wss.registerControllers(controllers);
    console.log(`📝 Registered ${controllers.length} WebSocket controllers`);
    return this;
  }

  /**
   * Sends a message to a specific connected WebSocket client.
   *
   * @param clientId - Unique client identifier.
   * @param message - Serializable payload to send.
   * @returns `true` if client exists and message was sent, otherwise `false`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sendToClient(clientId: string, message: any): boolean {
    return WebSocketService.getInstance().sendToClient(clientId, message);
  }

  /**
   * Publishes a payload to all clients subscribed to a topic.
   *
   * @param topic - Topic name.
   * @param data - Serializable topic payload.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public publishToTopic(topic: string, data: any) {
    WebSocketService.getInstance().publishToTopic(topic, data);
  }

  /**
   * Broadcasts a payload to all connected clients.
   *
   * @param message - Serializable payload.
   * @param excludeClientId - Optional client id to skip.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public broadcast(message: any, excludeClientId?: string) {
    WebSocketService.getInstance().broadcast(message, excludeClientId);
  }

  /**
   * Returns runtime stats for connected clients and topic subscriptions.
   */
  public getWebSocketStats() {
    return WebSocketService.getInstance().getStats();
  }

  /**
   * Indicates whether WebSocket server was initialized and is available.
   */
  public isWebSocketAvailable() {
    return WebSocketService.getInstance().isAvailable();
  }
}
