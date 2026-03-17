import { ServerResponse } from 'http';
import { PubSub } from 'type-graphql';
import { AppRequest, InterceptorCB, MiddlewareCB } from './common';
import { ControllerClass, ControllerType } from './controller';
import { CORSConfig } from './cors';
import { AppError } from './error';
import { HttpPlugin } from './plugins';
import { SanitizerConfig } from './sanitize';
import { StaticConfig } from './static';

export interface ServerConfig {
  /**
   * Port number the server listens on
   * @type {number}
   */
  port?: number;

  /**
   * Hostname or IP address
   * @type {string}
   */
  host?: string;

  /**
   * Array of middleware callback functions
   * @type {MiddlewareCB[]}
   */
  middlewares?: MiddlewareCB[];

  /**
   * Interceptor callback function
   * @type {InterceptorCB}
   */
  interceptor?: InterceptorCB;

  /**
   * Error handling callback
   * @type {ErrorCB}
   */
  errorHandler?: (
    error: AppError,
    req: AppRequest,
    response: LambdaResponse | ServerResponse,
  ) => any;

  /**
   * Array of controller types
   * @type {ControllerType[]}
   */
  controllers?: ControllerType[];

  /**
   * CORS configuration object
   * @type {CORSConfig}
   */
  cors?: CORSConfig;

  /**
   * Array of sanitizer configurations
   * @type {SanitizerConfig[]}
   */
  sanitizers?: SanitizerConfig[];

  /**
   * Array of static file serving configurations
   * @type {StaticConfig[]}
   */
  statics?: StaticConfig[];

  /**
   * WebSocket enablement and lazy loading
   * @type {{ enabled: boolean; lazy?: boolean }}
   */
  websocket?: { enabled: boolean; lazy?: boolean };

  /**
   * Server-Sent Events enablement
   * @type {{ enabled: boolean }}
   */
  sse?: { enabled: boolean };

  /**
   * Path for WebSocket connections
   * @type {string}
   */
  websocketPath?: string;

  /**
   * GraphQL configuration including playground, pubSub, and resolvers
   * @type {{ playground?: boolean; pubSub?: PubSub; resolvers?: Function[] }}
   */
  graphql?: {
    playground?: boolean;
    pubSub?: PubSub;
    resolvers?: Function[];
  };
}

import { Server } from 'http';
import { LambdaResponse } from './lambda';

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
