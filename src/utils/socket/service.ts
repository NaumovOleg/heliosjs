import { IWebSocketService } from '../../types/http';
import { WebSocketServer } from './server';

export class WebSocketService implements IWebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(wss: WebSocketServer) {
    this.wss = wss;
  }

  sendToClient(clientId: string, message: any): boolean {
    if (!this.wss) return false;
    return this.wss.sendToClient(clientId, message);
  }

  publishToTopic(topic: string, data: any, exclude?: string[]) {
    if (!this.wss) return;
    this.wss.publishToTopic(topic, data, exclude);
  }

  broadcast(message: any, excludeClientId?: string) {
    if (!this.wss) return;
    this.wss.broadcast(message, excludeClientId);
  }

  getStats() {
    if (!this.wss) return { clients: 0, topics: [] };
    return this.wss.getStats();
  }

  isAvailable(): boolean {
    return this.wss !== null;
  }
}
