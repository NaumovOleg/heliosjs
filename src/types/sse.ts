import { ServerResponse } from 'http';

export interface SSEClient {
  id: string;
  response: ServerResponse;
  topics: Set<string>;
  data: Record<string, any>;
  connectedAt: Date;
}

export interface SSEMessage {
  event?: string;
  id?: string;
  retry?: number;
  data: any;
}

export interface SSEEvent {
  type: 'connection' | 'close';
  client: SSEClient;
  data?: any;
}

export interface ISSEServer {
  createConnection(res: ServerResponse): SSEClient;
  sendToClient(clientId: string, message: SSEMessage): boolean;
  broadcast(message: SSEMessage, excludeClientId?: string): void;
  getStats(): { clients: number };
}

export interface ISSEService {
  initialize(sse: ISSEServer): void;
  sendToClient(clientId: string, message: SSEMessage): boolean;
  broadcast(message: SSEMessage, excludeClientId?: string): void;
  getStats(): { clients: number };
  isAvailable(): boolean;
  createConnection(res: ServerResponse): SSEClient;
}
