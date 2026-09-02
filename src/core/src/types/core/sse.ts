import type { ServerResponse } from 'node:http';

export interface SSEClient {
  id: string;
  response: ServerResponse;
  topics: Set<string>;
  data: Record<string, unknown>;
  connectedAt: Date;
}

export interface SSEMessage {
  event?: string;
  id?: string;
  retry?: number;
  data: unknown;
}

export interface SSEEvent {
  type: 'connection' | 'close';
  client: SSEClient;
  data?: unknown;
}

export interface ISSEServer {
  createConnection(res: ServerResponse, origin?: string): SSEClient;
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
  createConnection(res: ServerResponse, origin?: string): SSEClient;
}
