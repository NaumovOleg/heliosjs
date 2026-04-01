import { Server } from 'node:http';
import { PubSub } from 'type-graphql';
import { InterceptorCB, MiddlewareCB } from '../core/common';
import { ControllerClass, ControllerType } from '../core/controller';
import { CORSConfig } from '../core/cors';
import { ErorrHandler } from '../core/error';
import { SanitizerConfig } from '../core/sanitize';
import { Plugin } from './plugin';
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
  interceptors: InterceptorCB[];

  /**
   * Error handling callback
   * @type {ErorrHandler}
   */
  errorHandler?: ErorrHandler;

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
   * @type {{ path: string; lazy?: boolean }}
   */
  websocket?: { path: string; lazy?: boolean; controllers: ControllerType[] };

  /**
   * Server-Sent Events enablement
   * @type {{ enabled: boolean }}
   */
  sse?: { enabled: boolean };

  /**
   * GraphQL configuration including playground, pubSub, and resolvers
   * @type {{ playground?: boolean; pubSub?: PubSub; resolvers?: Function[] }}
   */
  graphql?: {
    path: string;
    playground?: boolean;
    pubSub?: PubSub;
    resolvers?: Function[];
  };
}

export interface IHttpServer {
  readonly app: Server;
  plugins: Plugin[];
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

  usePlugin(plugin: Plugin): IHttpServer;
}
