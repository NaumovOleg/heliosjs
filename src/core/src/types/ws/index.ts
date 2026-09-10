import type WebSocket from 'ws';

/**
 * WebSocket connection lifecycle phase a handler can target:
 * - `'connection'` — a client finished the handshake;
 * - `'message'` — a client sent a frame;
 * - `'close'` — a client disconnected;
 * - `'error'` — the socket errored.
 */
export type WebSocketHandlerType = 'connection' | 'message' | 'close' | 'error';

/** Payload passed to a `@OnWS` handler for one WebSocket event. */
export interface WebSocketEvent {
  /** Which lifecycle phase fired this event. */
  type: WebSocketHandlerType;
  /** The client the event belongs to. */
  client: WebSocketClient;
  /** The decoded frame — present only for `type: 'message'`. */
  message?: WebSocketMessage;
  /** Free-form extra data (e.g. the error for `type: 'error'`). */
  data?: unknown;
}

/** A connected WebSocket client tracked by the server. */
export interface WebSocketClient {
  /** Server-assigned unique id, used as the target of `sendToClient`. */
  id: string;
  /** The underlying `ws` socket. */
  socket: WebSocket;
  /** Topic names this client is currently subscribed to. */
  topics: Set<string>;
  /** Per-connection scratch store for app data (auth user, session, …). */
  data: Record<string, unknown>;
  /** When the handshake completed. */
  connectedAt: Date;
}

/** Envelope for a WebSocket frame, in and out. */
export interface WebSocketMessage {
  /** App-defined message kind, used to route to the right handler. */
  type: string;
  /** Optional topic/namespace for pub-sub delivery and `@OnMessage(topic)` filtering. */
  topic?: string;
  /** The message body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  /** Sender/target client id (set by the server on inbound messages). */
  clientId?: string;
}

/** Snapshot returned by `getStats()`. */
export interface WebSocketStats {
  /** Number of currently connected clients. */
  clients: number;
  /** Per-topic subscriber counts. */
  topics: {
    topic: string;
    subscribers: number;
  }[];
}

/**
 * Public surface of the WebSocket service singleton (injected via `@InjectWS()`).
 * Use it to push data to clients from anywhere in the app.
 */
export interface IWebSocketService {
  /**
   * Sends `message` to one client.
   * @param clientId - Target client id.
   * @param message - Payload (serialized to JSON).
   * @returns `true` if the client existed and the frame was queued.
   */
  sendToClient(clientId: string, message: unknown): boolean;
  /**
   * Publishes `data` to every subscriber of `topic`.
   * @param topic - Topic name.
   * @param data - Payload.
   * @param exclude - Client ids to skip (e.g. the originating sender).
   */
  publishToTopic(topic: string, data: any, exclude?: string[]): void;
  /**
   * Sends `message` to every connected client.
   * @param excludeClientId - Optional single client id to skip.
   */
  broadcast(message: unknown, excludeClientId?: string): void;
  /** Returns connection and per-topic subscriber counts. */
  getStats(): { clients: number; topics: { topic: string; subscribers: number }[] };
  /** `true` when a WebSocket server has been initialized (i.e. `websocket` is enabled). */
  isAvailable(): boolean;
}

/**
 * Public surface of the underlying WebSocket server. Application code normally
 * uses {@link IWebSocketService} instead; this is what adapters wire up.
 */
export interface IWebSocketServer {
  /** Sends `message` to one client. @returns `true` if delivered. */
  sendToClient(clientId: string, message: unknown): boolean;
  /** Publishes `data` to `topic` subscribers, skipping ids in `exclude`. */
  publishToTopic(topic: string, data: any, exclude: string[]): void;
  /** Sends `message` to all clients, optionally skipping `excludeClientId`. */
  broadcast(message: unknown, excludeClientId?: string): void;
  /** Returns a {@link WebSocketStats} snapshot. */
  getStats(): WebSocketStats;
  /** Adds `client` to `topic` (server-side subscribe). */
  subscribeToTopic(client: WebSocketClient, topic: string): void;
  /** Removes `client` from `topic`. */
  unsubscribeFromTopic(client: WebSocketClient, topic: string): void;
  /** Scans the given controller classes for `@OnWS` / `@Subscribe` handlers and registers them. */
  registerControllers(controllers: (new (...args: any[]) => any)[]): void;
}
