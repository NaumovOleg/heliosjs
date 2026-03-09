import { ErrorCB, InterceptorCB, MiddlewareCB } from './common';

export interface ServerConfig {
  port?: number;
  host?: string;
  midlewares?: MiddlewareCB[];
  interceptors?: InterceptorCB[];
  errorHandler?: ErrorCB;
  controllers?: (new (...args: any[]) => any)[];
  websocket?: {
    enabled: boolean;
    path?: string;
    lazy?: boolean;
  };
}

export type Conf = ServerConfig & {
  globalMiddlewares?: any[];
  globalInterceptors?: any[];
  globalErrorHandler?: any;
};
