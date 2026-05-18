import {
  CONTROLLER_GET_SSE_CONTROLLER,
  CONTROLLER_GET_SSE_HANDLERS,
  CONTROLLER_GET_WS_HANDLERS,
  CONTROLLER_GET_WS_TOPICS,
  CONTROLLER_LOOKUP_SSE,
  CONTROLLER_LOOKUP_WS,
  CONTROLLER_META,
  CONTROLLER_PRECOMPILED,
  CONTROLLER_REQUEST,
  CONTROLLER_TYPED_HANDLERS,
} from '../../constants';
import type { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import type { CORSConfig } from './cors';
import type { ErrorHandler } from './error';
import type { Request } from './request';
import type { Response } from './response';
import type { SanitizerConfig } from './sanitize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControllerClass = new (...args: any[]) => any;

export interface IController {
  [CONTROLLER_PRECOMPILED]: ControllerMeta;
  [CONTROLLER_META]: (parent: Omit<ControllerMeta, 'controllers'>) => ControllerMeta;
  websocket?: WsControllerHandlers;
  sse?: SeeControllerHandlers;
  [CONTROLLER_REQUEST]: (request: Request, response: Response) => Promise<Response | null>;
  [CONTROLLER_LOOKUP_WS]: () => void;
  [CONTROLLER_LOOKUP_SSE]: () => void;
  [CONTROLLER_GET_WS_TOPICS]: () => unknown[];
  [CONTROLLER_GET_WS_HANDLERS]: (type: string) => WsHandlerMeta[];
  [CONTROLLER_GET_SSE_HANDLERS]: (type: string) => WsHandlerMeta[];
  [CONTROLLER_TYPED_HANDLERS]: (handlers: WsHandlerMeta[], type: string) => WsHandlerMeta[];
  [CONTROLLER_GET_SSE_CONTROLLER]: () => {
    instance: IController;
    handlers: {
      connection: ReturnType<IController[typeof CONTROLLER_GET_SSE_HANDLERS]>;
      close: ReturnType<IController[typeof CONTROLLER_GET_SSE_HANDLERS]>;
      error: ReturnType<IController[typeof CONTROLLER_GET_SSE_HANDLERS]>;
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
  [CONTROLLER_PRECOMPILED]?: ControllerMeta;
  [CONTROLLER_META]?(parent: Omit<ControllerMeta, 'controllers'>): ControllerMeta;
  [CONTROLLER_REQUEST]?(request: Request, response: Response): Promise<any>;
  [CONTROLLER_LOOKUP_WS]?(): void;
  [CONTROLLER_LOOKUP_SSE]?(): void;
  [CONTROLLER_GET_WS_TOPICS]?(): unknown[];
  [CONTROLLER_GET_WS_HANDLERS]?(type: string): WsHandlerMeta[];
  [CONTROLLER_GET_SSE_HANDLERS]?(type: string): WsHandlerMeta[];
  [CONTROLLER_TYPED_HANDLERS]?(handlers: WsHandlerMeta[], type: string): WsHandlerMeta[];
  [CONTROLLER_GET_SSE_CONTROLLER]?(): {
    instance: IController;
    handlers: {
      connection: ReturnType<NonNullable<ControllerType[typeof CONTROLLER_GET_SSE_HANDLERS]>>;
      close: ReturnType<NonNullable<ControllerType[typeof CONTROLLER_GET_SSE_HANDLERS]>>;
      error: ReturnType<NonNullable<ControllerType[typeof CONTROLLER_GET_SSE_HANDLERS]>>;
    };
  };
  websocket?: WsControllerHandlers;
  sse?: SeeControllerHandlers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: (body: any, request: Request) => any;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
