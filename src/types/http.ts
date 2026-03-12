import { ErrorCB, InterceptorCB, MiddlewareCB } from './common';
import { CORSConfig } from './cors';
import { SanitizerConfig } from './sanitize';

export interface ServerConfig {
  port?: number;
  host?: string;
  middlewares?: MiddlewareCB[];
  interceptor?: InterceptorCB;
  errorHandler?: ErrorCB;
  controllers?: (new (...args: any[]) => any)[];
  cors?: CORSConfig;
  sanitizers?: SanitizerConfig[];
  websocket?: {
    enabled: boolean;
    path?: string;
    lazy?: boolean;
  };
  sse?: { enabled: boolean };
}
