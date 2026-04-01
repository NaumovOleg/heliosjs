import { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import { CORSConfig } from './cors';
import { ErorrHandler } from './error';
import { Request } from './request';
import { Response } from './response';
import { SanitizerConfig } from './sanitize';

export type ControllerClass = { new (...args: any[]): any };

export type ControllerMethods = Array<{
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}>;

export type ControllerType = {
  handleRequest?(request: Request, response: Response): Promise<any>;
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
  errorHandler?: ErorrHandler;
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
  errorHandlerChain: ErorrHandler[];
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
export type Route = {
  name: string;
  route: string;
  method: HTTP_METHODS;
  cors?: CORSConfig[];
  ok: number;
  paramMetadata: ParamMetadata[];
  interceptors: InterceptorCB[];
  functions: {
    sanitizers: SanitizerConfig[];
    errors: ErorrHandler[];
    middlewares: MiddlewareCB[];
  }[];
  fn: (...args: any[]) => any;
};
export type NextFunction = (error?: unknown) => void;
export type ControllerMeta = {
  prefix: string;
  routes: Route[];
  interceptors: InterceptorCB[];
  cors: CORSConfig[];
  functions: {
    sanitizers: SanitizerConfig[];
    errors: ErorrHandler[];
    middlewares: MiddlewareCB[];
  }[];
  children?: ControllerMeta[];
};
