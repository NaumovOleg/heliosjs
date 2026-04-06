import { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import { CORSConfig } from './cors';
import { ErrorHandler } from './error';
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

export interface ControllerConfig {
  prefix: string;
  middlewares?: Array<MiddlewareCB>;
  controllers?: ControllerInstance[];
}

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

export type FunctionsMeta = {
  middlewares: MiddlewareCB[];
  errors: ErrorHandler[];
  cors: CORSConfig[];
  sanitizers: SanitizerConfig[];
  pipes: Pipe[];
  guards: (Guard | GuardFn)[];
  interceptors: InterceptorCB[];
  status?: number;
};
export type Route = {
  name: string;
  route: string;
  method: HTTP_METHODS;
  cors?: CORSConfig[];
  ok: number;
  parameters: ParamMetadata[];
  interceptor?: InterceptorCB;
  functions: FunctionsMeta[];
  fn: (...args: any[]) => any;
};
export type NextFunction = (error?: unknown) => void;
export type ControllerMeta = {
  prefix: string;
  name: string;
  routes: Route[];
  children?: ControllerMeta[];
  functions: MiddlewaresMetadata[];
  controllers: ControllerClass[];
};

export type ControllerMetadata = {
  prefix: string;
  name: string;
  middlewares: MiddlewareCB[];
  controllers: ControllerInstance[];
};
export type RouteMetadata = {
  route: string;
  method: HTTP_METHODS;
  middlewares: MiddlewareCB[];
  parameters: ParamMetadata[];
};

export type PipeKey = 'body' | 'query' | 'params' | 'headers';

export type Pipe = {
  body?: (body: unknown, request: Request) => unknown;
  query?: (
    query: Record<string, string | string[]>,
    request: Request,
  ) => Record<string, string | string[]>;
  params?: (params: Record<string, string>, request: Request) => Record<string, string>;
  headers?: (
    headers: Record<string, string | string[]>,
    request: Request,
  ) => Record<string, string | string[]>;
};

export interface Guard {
  new (...any: any[]): any;
  canActivate(request: Request, response: Response): boolean;
}

export type GuardFn = (request: Request, response: Response) => boolean;

export type MiddlewaresMetadata = {
  middlewares: MiddlewareCB[];
  errors: ErrorHandler[];
  cors: CORSConfig[];
  sanitizers: SanitizerConfig[];
  pipes: Pipe[];
  guards: (Guard | GuardFn)[];
  interceptors: InterceptorCB[];
  status?: number;
};
