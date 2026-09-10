import type { ServerResponse } from 'node:http';

/** A connected Server-Sent Events client tracked by the server. */
export interface SSEClient {
  /** Server-assigned unique id, used as the target of `sendToClient`. */
  id: string;
  /** The kept-open Node response the stream is written to. */
  response: ServerResponse;
  /** Topic names this client is subscribed to. */
  topics: Set<string>;
  /** Per-connection scratch store for app data. */
  data: Record<string, unknown>;
  /** When the connection was opened. */
  connectedAt: Date;
}

/** One SSE frame, formatted onto the wire as `event:`/`id:`/`retry:`/`data:` lines. */
export interface SSEMessage {
  /** Value of the `event:` field; the browser `EventSource` event name. */
  event?: string;
  /** Value of the `id:` field, used for `Last-Event-ID` reconnection. */
  id?: string;
  /** Value of the `retry:` field — client reconnection delay in ms. */
  retry?: number;
  /** Payload, JSON-stringified into the `data:` field. */
  data: unknown;
}

/** Payload passed to a `@OnSSE` handler for one stream lifecycle event. */
export interface SSEEvent {
  /** Which lifecycle phase fired this event. */
  type: 'connection' | 'close';
  /** The client the event belongs to. */
  client: SSEClient;
  /** Free-form extra data. */
  data?: unknown;
}

/** Public surface of the underlying SSE server; app code normally uses {@link ISSEService}. */
export interface ISSEServer {
  /**
   * Opens a new SSE connection on `res` and registers the client.
   * @param res - The Node response to keep open and stream to.
   * @param origin - Optional origin, used for a CORS check when configured.
   */
  createConnection(res: ServerResponse, origin?: string): SSEClient;
  /**
   * Sends `message` to one client.
   * @param clientId - Target client id.
   * @param message - Frame to send.
   * @returns `true` if the client existed and the frame was written.
   */
  sendToClient(clientId: string, message: SSEMessage): boolean;
  /**
   * Sends `message` to every connected client.
   * @param excludeClientId - Optional client id to skip.
   */
  broadcast(message: SSEMessage, excludeClientId?: string): void;
  /** Returns the current connected-client count. */
  getStats(): { clients: number };
}

/** Public surface of the SSE service singleton (injected via `@InjectSSE()`). */
export interface ISSEService {
  /** Wires the service to a running {@link ISSEServer}. Called by the adapter. */
  initialize(sse: ISSEServer): void;
  /** Sends `message` to one client. @returns `true` if delivered. */
  sendToClient(clientId: string, message: SSEMessage): boolean;
  /** Sends `message` to all clients, optionally skipping `excludeClientId`. */
  broadcast(message: SSEMessage, excludeClientId?: string): void;
  /** Returns the current connected-client count. */
  getStats(): { clients: number };
  /** `true` when an SSE server has been initialized (i.e. `sse.enabled` is set). */
  isAvailable(): boolean;
  /**
   * Opens a new SSE connection on `res`.
   * @param res - The Node response to keep open and stream to.
   * @param origin - Optional origin, used for a CORS check when configured.
   */
  createConnection(res: ServerResponse, origin?: string): SSEClient;
}
