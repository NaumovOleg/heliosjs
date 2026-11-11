// server/SSEServer.ts
import type { ServerResponse } from 'node:http';

import type {
  CORSConfig,
  ControllerType,
  ISSEServer,
  SSEClient,
  SSEEvent,
  SSEMessage,
  SSEServerOptions,
} from '../../types/core';
import { assertValidCORSConfig } from '../core/cors';
import { getGlobalLogger } from '../core/logger';
import { generateUniqueId, getBoundRequest } from '../shared';

/**
 * @internal Low-level Server-Sent Events server: tracks connected clients and
 * dispatches to `@OnSSE` handlers on registered controllers. Constructed by the
 * `@heliosjs/http` `Helios` adapter when `sse.enabled` is configured. App code
 * should use `SSEService.getInstance()` (or `@InjectSSE()`) instead of this
 * class directly.
 */
export class SSEServer implements ISSEServer {
  private readonly clients = new Map<string, SSEClient>();
  private readonly options: Required<
    Pick<SSEServerOptions, 'maxConnections' | 'heartbeatMs' | 'maxMessageBytes'>
  > &
    Pick<SSEServerOptions, 'authenticate'>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers: any[] = [];
  private corsConfig?: CORSConfig;

  constructor(options: SSEServerOptions = {}) {
    validatePositiveLimit(options.maxConnections, 'maxConnections', true);
    validatePositiveLimit(options.heartbeatMs, 'heartbeatMs', false);
    validatePositiveLimit(options.maxMessageBytes, 'maxMessageBytes', true);
    this.options = {
      maxConnections: options.maxConnections ?? 1000,
      heartbeatMs: options.heartbeatMs ?? 30_000,
      maxMessageBytes: options.maxMessageBytes ?? 1024 * 1024,
      authenticate: options.authenticate,
    };
  }

  /** Sets the CORS policy used to validate the `Origin` of new SSE connections. */
  setCorsConfig(config: CORSConfig) {
    assertValidCORSConfig(config);
    this.corsConfig = config;
  }

  /**
   * Creates and registers a new SSE client connection.
   *
   * The connection is rejected when `authenticate` is configured and either
   * fails or the originating request cannot be resolved. This applies to every
   * connection, including ones opened directly from a controller route.
   *
   * @param res - Raw HTTP response used as event stream transport.
   * @param origin - Optional origin header value for CORS.
   * @returns Registered SSE client descriptor, or `undefined` when rejected.
   */
  public async createConnection(
    res: ServerResponse,
    origin?: string,
  ): Promise<SSEClient | undefined> {
    if (this.options.authenticate) {
      const request = getBoundRequest(res);
      let authenticated = false;
      if (request) {
        try {
          authenticated = await this.options.authenticate(request);
        } catch {
          authenticated = false;
        }
      }
      if (!authenticated) {
        this.rejectConnection(res, 401, 'SSE authentication required');
        return undefined;
      }
    }

    if (this.clients.size >= this.options.maxConnections) {
      this.rejectConnection(res, 503, 'SSE connection limit reached');
      return undefined;
    }

    if (origin && this.corsConfig && !this.isOriginAllowed(origin)) {
      this.rejectConnection(res, 403, 'SSE origin not allowed');
      return undefined;
    }

    const clientId = generateUniqueId();

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };

    if (origin && this.corsConfig) {
      const allowed = this.isOriginAllowed(origin);
      if (allowed) {
        headers['Access-Control-Allow-Origin'] =
          this.corsConfig.origin === '*' && !this.corsConfig.credentials ? '*' : origin;
        headers['Vary'] = 'Origin';
        if (this.corsConfig.credentials) {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
      }
    }

    res.writeHead(200, headers);

    res.write(': connected\n\n');

    const client: SSEClient = {
      id: clientId,
      response: res,
      topics: new Set(),
      data: {},
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);
    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) {
        clearInterval(heartbeat);
        return;
      }
      res.write(': heartbeat\n\n');
    }, this.options.heartbeatMs);
    heartbeat.unref?.();

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.triggerHandlers('connection', { type: 'connection', client, data: res });

    res.on('close', async () => {
      clearInterval(heartbeat);
      this.clients.delete(clientId);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.triggerHandlers('close', { type: 'close', client });
    });

    return client;
  }

  private rejectConnection(res: ServerResponse, status: number, message: string): void {
    if (typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'text/plain' });
    } else {
      res.statusCode = status;
    }
    res.end?.(message);
  }

  private isOriginAllowed(origin: string): boolean {
    if (!this.corsConfig) return true;
    if (this.corsConfig.credentials && this.corsConfig.origin === '*') return false;
    if (this.corsConfig.origin === '*') return true;
    if (typeof this.corsConfig.origin === 'string') return this.corsConfig.origin === origin;
    if (Array.isArray(this.corsConfig.origin)) return this.corsConfig.origin.includes(origin);
    if (typeof this.corsConfig.origin === 'function') return this.corsConfig.origin(origin);
    return false;
  }

  /**
   * Sends a server-sent event payload to a specific client.
   *
   * @param clientId - Target client id.
   * @param message - SSE message fields (`event`, `id`, `retry`, `data`).
   * @returns `true` if message was written successfully.
   */
  public sendToClient(clientId: string, message: SSEMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      let sseMessage = '';
      if (message.event) sseMessage += `event: ${message.event}\n`;
      if (message.id) sseMessage += `id: ${message.id}\n`;
      if (message.retry) sseMessage += `retry: ${message.retry}\n`;

      const dataStr =
        typeof message.data === 'string' ? message.data : JSON.stringify(message.data);

      dataStr.split('\n').forEach((line) => {
        sseMessage += `data: ${line}\n`;
      });
      sseMessage += '\n';

      if (Buffer.byteLength(sseMessage, 'utf8') > this.options.maxMessageBytes) {
        getGlobalLogger().warn(`sse: message for ${clientId} exceeds maxMessageBytes`);
        return false;
      }

      return client.response.write(sseMessage) !== false;
    } catch (error) {
      getGlobalLogger().error(`sse: send to ${clientId} failed`, error);
      return false;
    }
  }

  /**
   * Broadcasts one SSE message to all connected clients.
   *
   * @param message - SSE payload to broadcast.
   * @param excludeClientId - Optional client id to skip.
   */
  public broadcast(message: SSEMessage, excludeClientId?: string) {
    this.clients.forEach((_, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  /**
   * Returns current SSE connection statistics.
   */
  public getStats() {
    return { clients: this.clients.size };
  }

  /**
   * Registers controller instances that define SSE handlers.
   *
   * @param controllers - Controller instances with SSE metadata.
   */
  registerControllers(controllers: ControllerType[]) {
    this.controllers = controllers.filter((c) => c.sse);
  }

  private async triggerHandlers(eventType: string, event: SSEEvent) {
    for (const controller of this.controllers) {
      if (controller.sse?.handlers?.[eventType]) {
        for (const handler of controller.sse.handlers[eventType]) {
          // `fn` isn't guaranteed to be async — Promise.resolve() so a sync
          // handler (or one that returns a plain value) doesn't crash `.catch`.
          await Promise.resolve(handler.fn(event)).catch((err: unknown) =>
            getGlobalLogger().error('sse: handler failed', err)
          );
        }
      }
    }
  }
}

function validatePositiveLimit(value: number | undefined, name: string, allowZero: boolean): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || !Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new TypeError(`SSE ${name} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  }
}
