import type { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import type { CORSConfig } from './cors';
import type { ErrorHandler } from './error';
import type { Request } from './request';
import type { Response } from './response';
import type { SanitizerConfig } from './sanitize';

export type ControllerClass = new (...args: any[]) => any;

export interface IController {
  precompiled: ControllerMeta;
  meta: (parent: Omit<ControllerMeta, 'controllers'>) => ControllerMeta;
  websocket?: WsControllerHandlers;
  sse?: SeeControllerHandlers;
  request: (request: Request, response: Response) => Promise<Response>;
  lookupWs: () => void;
  lookupSse: () => void;
  getWsTopics: () => unknown[];
  getWsHandlers: (type: string) => WsHandlerMeta[];
  getSseHandlers: (type: string) => WsHandlerMeta[];
  typedHandlers: (handlers: WsHandlerMeta[], type: string) => WsHandlerMeta[];
  getSseController: () => {
    instance: IController;
    handlers: {
      connection: ReturnType<IController['getSseHandlers']>;
      close: ReturnType<IController['getSseHandlers']>;
      error: ReturnType<IController['getSseHandlers']>;
    };
  };
}

export type ControllerMethods = {
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}[];

export interface ControllerType {
  request?(request: Request, response: Response): Promise<any>;
  websocket?: WsControllerHandlers;
  sse?: SeeControllerHandlers;
  new (...args: any[]): any;
}

export type ControllerInstance = InstanceType<ControllerType>;

export interface ControllerConfig {
  prefix: string;
  middlewares?: MiddlewareCB[];
  controllers?: ControllerInstance[];
}

export interface SSE_HANDLER_META {
  type: string;
  method: string;
}

export interface WsHandlerMeta {
  type: string;
  topic?: undefined;
  method: string;
  fn: (...args: any[]) => any;
}

export interface WsControllerHandlers {
  handlers: {
    connection: WsHandlerMeta[];
    message: WsHandlerMeta[];
    close: WsHandlerMeta[];
    error: WsHandlerMeta[];
  };
  topics: WsHandlerMeta[];
}

export interface SeeControllerHandlers {
  handlers: {
    connection: WsHandlerMeta[];
    close: WsHandlerMeta[];
    error: WsHandlerMeta[];
  };
}

export interface FunctionsMeta {
  middlewares: MiddlewareCB[];
  errors: ErrorHandler[];
  cors: CORSConfig[];
  sanitizers: SanitizerConfig[];
  pipes: Pipe[];
  guards: (GuardClass | GuardFunction)[];
  interceptors: InterceptorCB[];
  status?: number;
}
export interface Route {
  name: string;
  route: string;
  method: HTTP_METHODS;
  cors?: CORSConfig[];
  parameters: ParamMetadata[];
  functions: MiddlewaresMetadataItem[];
  fn: (...args: any[]) => any;
}
export type NextFunction = (error?: unknown) => void;
export interface ControllerMeta {
  prefix: string;
  name: string;
  routes: Route[];
  children?: ControllerMeta[];
  functions: MiddlewaresMetadataItem[];
  controllers: ControllerClass[];
}

export interface ControllerMetadata {
  prefix: string;
  name: string;
  middlewares: MiddlewareCB[];
  controllers: ControllerInstance[];
}
export interface RouteMetadata {
  route: string;
  method: HTTP_METHODS;
  middlewares: MiddlewareCB[];
  parameters: ParamMetadata[];
}

export type PipeKey = 'body' | 'query' | 'params' | 'headers';

export interface Pipe {
  body?: (body: unknown, request: Request) => unknown;
  query?: (
    query: Record<string, string | string[]>,
    request: Request
  ) => Record<string, string | string[]>;
  params?: (params: Record<string, string>, request: Request) => Record<string, string>;
  headers?: (
    headers: Record<string, string | string[]>,
    request: Request
  ) => Record<string, string | string[]>;
}

export interface GuardInstance {
  message?: string;
  canActivate(request: Request, response: Response): Promise<boolean> | boolean | string;
}

export type GuardClass = new (...args: any[]) => GuardInstance;
export type GuardFunction = (
  request: Request,
  response: Response
) => Promise<boolean | string> | boolean | string;

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

interface MiddlewareTypeMap {
  middleware: MiddlewareCB;
  errorHandler: ErrorHandler;
  cors: CORSConfig;
  pipe: Pipe;
  guard: GuardClass | GuardFunction | GuardInstance;
  interceptor: InterceptorCB;
  status: number;
  sanitizer: SanitizerConfig;
}

export type MiddlewaresMetadataItem = {
  [K in MiddleWareItemType]?: MiddlewareTypeMap[K];
};
