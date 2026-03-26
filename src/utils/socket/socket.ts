import { WebSocketServer } from './server';
import { WebSocketService } from './service';

export class Socket {
  protected wss!: WebSocketServer;

  public registerWebSocketControllers(controllers: any[]) {
    if (!this.wss) {
      console.warn(
        '⚠️ WebSocket is disabled. Enable it in config: { websocket: { enabled: true } }',
      );
      return this;
    }
    this.wss.registerControllers(controllers);
    console.log(`📝 Registered ${controllers.length} WebSocket controllers`);
    return this;
  }

  public sendToClient(clientId: string, message: any): boolean {
    return WebSocketService.getInstance().sendToClient(clientId, message);
  }

  public publishToTopic(topic: string, data: any) {
    WebSocketService.getInstance().publishToTopic(topic, data);
  }

  public broadcast(message: any, excludeClientId?: string) {
    WebSocketService.getInstance().broadcast(message, excludeClientId);
  }

  public getWebSocketStats() {
    return WebSocketService.getInstance().getStats();
  }

  public isWebSocketAvailable() {
    return WebSocketService.getInstance().isAvailable();
  }
}
