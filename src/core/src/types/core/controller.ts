import { HANDLE_REQUEST_HASH, WS_HASH } from '../../constants';
import { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import { CORSConfig } from './cors';
import { ErrorHandler } from './error';
import { Request } from './request';
import { Response } from './response';
import { SanitizerConfig } from './sanitize';

export type ControllerClass = new (...args: any[]) => any;

export type ControllerMethods = Array<{
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}>;

export type ControllerType = {
  [HANDLE_REQUEST_HASH]?(request: Request, response: Response): Promise<any>;
  [WS_HASH]?: WsControllerHandlers;
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
  guards: (GuardClass | GuardFunction)[];
  interceptors: InterceptorCB[];
  status?: number;
};
export type Route = {
  name: string;
  route: string;
  method: HTTP_METHODS;
  cors?: CORSConfig[];
  parameters: ParamMetadata[];
  functions: MiddlewaresMetadataItem[];
  fn: (...args: any[]) => any;
};
export type NextFunction = (error?: unknown) => void;
export type ControllerMeta = {
  prefix: string;
  name: string;
  routes: Route[];
  children?: ControllerMeta[];
  functions: MiddlewaresMetadataItem[];
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

export interface GuardClass {
  new (...any: any[]): any;
  canActivate(request: Request, response: Response): boolean;
}

export type GuardFunction = (request: Request, response: Response) => boolean;

export enum MiddlewaresMetadataItemProperty {
  middleware = 'middleware',
  errorHandler = 'errorHandler',
  cors = 'cors',
  pipe = 'pipe',
  guard = 'guard',
  interceptor = 'interceptor',
  status = 'status',
  sanitizer = 'sanitizer',
}

export type MiddleWareItemType =
  | 'middleware'
  | 'errorHandler'
  | 'cors'
  | 'pipe'
  | 'guard'
  | 'interceptor'
  | 'status'
  | 'sanitizer';

type MiddlewareTypeMap = {
  middleware: MiddlewareCB;
  errorHandler: ErrorHandler;
  cors: CORSConfig;
  pipe: Pipe;
  guard: GuardClass | GuardFunction;
  interceptor: InterceptorCB;
  status: number;
  sanitizer: SanitizerConfig;
};

export type MiddlewaresMetadataItem = {
  [K in MiddleWareItemType]?: MiddlewareTypeMap[K];
};
