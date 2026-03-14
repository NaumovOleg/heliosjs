import { ErrorCB, InterceptorCB, MiddlewareCB } from './common';
import { ControllerClass, ControllerType } from './controller';
import { CORSConfig } from './cors';
import { HttpPlugin } from './plugins';
import { SanitizerConfig } from './sanitize';
import { StaticConfig } from './static';

export interface ServerConfig {
  port?: number;
  host?: string;
  middlewares?: MiddlewareCB[];
  interceptor?: InterceptorCB;
  errorHandler?: ErrorCB;
  controllers?: ControllerType[];
  cors?: CORSConfig;
  sanitizers?: SanitizerConfig[];
  statics?: StaticConfig[];
  websocket?: {
    enabled: boolean;
    path?: string;
    lazy?: boolean;
  };
  resolvers?: any[];
  sse?: { enabled: boolean };
  graphql?: { enabled: boolean; playground?: boolean; path?: string; websocket?: boolean };
}

import { Server } from 'http';

export interface IHttpServer {
  readonly app: Server;
  plugins: HttpPlugin[];
  controllers: ControllerClass[];

  /**
   * Starts HTTP server
   * @param port - port
   * @param host - host
   * @returns Promise with HTTP server instance
   * @throws Error
   */
  listen(port?: number, host?: string): Promise<Server>;

  /**
   * Stops server
   * @returns Promise
   * @throws Error
   */
  close(): Promise<void>;

  /**
   * Get server status
   * @returns object with server config
   */
  status(): { running: boolean; config: ServerConfig };

  usePlugin(plugin: HttpPlugin): IHttpServer;
}
