import { ServerResponse } from 'http';
import { ErrorCB, HTTP_METHODS, InterceptorCB, MiddlewareCB } from './common';
import { CORSConfig } from './cors';
import { Request } from './request';
import { SanitizerConfig } from './sanitize';

export type ControllerClass = { new (...args: any[]): any };
// export type ControllerInstance = InstanceType<ControllerClass>;

export type ControllerMethods = Array<{
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}>;

export type ControllerType = {
  handleRequest?(request: Request, response: ServerResponse): Promise<any>;
  ws?: WsControllerHandlers;
  sse?: SeeControllerHandlers;
  new (...args: any[]): any;
};

export type ControllerInstance = InstanceType<ControllerType>;

export type ControllerMetadata = {
  routePrefix: string;
  middlewares: MiddlewareCB[];
  interceptor?: InterceptorCB;
  subControllers: ControllerInstance[];
  errorHandler?: ErrorCB;
  cors?: CORSConfig;
  sanitizers: SanitizerConfig[];
};

export interface ControllerConfig {
  prefix: string;
  middlewares?: Array<MiddlewareCB>;
  controllers?: ControllerInstance[];
  interceptor?: InterceptorCB;
}

export type RouteContext = {
  controllerInstance: any;
  controllerMeta: ControllerMetadata;
  path: string;
  method: string;
  middlewareChain: MiddlewareCB[];
  interceptorChain: InterceptorCB[];
  corsChain: CORSConfig[];
  errorHandlerChain: ErrorCB[];
  subPath: string;
  sanitizersChain: SanitizerConfig[];
};

export type SSE_HANDLER_META = {
  type: string;
  method: string;
};

export type HandlerMeta = {
  type: 'connection';
  topic: undefined;
  method: 'onconnect';
  fn: (...args: any[]) => any;
};

export type WsHandlerMeta = HandlerMeta & { topic?: string };

export type WsControllerHandlers = {
  handlers: {
    connection: WsHandlerMeta[];
    message: WsHandlerMeta[];
    close: WsHandlerMeta[];
    error: WsHandlerMeta[];
  };
  topics: HandlerMeta[];
};

export type SeeControllerHandlers = {
  handlers: {
    connection: HandlerMeta[];
    close: HandlerMeta[];
    error: HandlerMeta[];
  };
};
export type NextFunction = (error?: unknown) => void;
