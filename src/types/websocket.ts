import WebSocket from 'ws';

export type WebSocketHandlerType = 'connection' | 'message' | 'close' | 'error';

export interface WebSocketMessage {
  type: string;
  topic?: string;
  data: any;
  clientId?: string;
}

export interface WebSocketEvent {
  type: WebSocketHandlerType;
  client: WebSocketClient;
  message?: WebSocketMessage;
  data?: any;
}

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  topics: Set<string>;
  data: Record<string, any>;
  connectedAt: Date;
}

export interface WebSocketMessage {
  type: string;
  topic?: string;
  data: any;
  clientId?: string;
}

export interface WebSocketStats {
  clients: number;
  topics: Array<{
    topic: string;
    subscribers: number;
  }>;
}

export interface IWebSocketService {
  sendToClient(clientId: string, message: any): boolean;
  publishToTopic(topic: string, data: any, exclude?: string[]): void;
  broadcast(message: any, excludeClientId?: string): void;
  getStats(): { clients: number; topics: Array<{ topic: string; subscribers: number }> };
  isAvailable(): boolean;
}

export interface IWebSocketServer {
  sendToClient(clientId: string, message: any): boolean;
  publishToTopic(topic: string, data: any, exclude: string[]): void;
  broadcast(message: any, excludeClientId?: string): void;
  getStats(): WebSocketStats;
  subscribeToTopic(client: WebSocketClient, topic: string): void;
  unsubscribeFromTopic(client: WebSocketClient, topic: string): void;
}
