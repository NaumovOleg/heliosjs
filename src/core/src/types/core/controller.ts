import type { CONTROLLER_PRECOMPILED } from '../../constants';
import {
  CONTROLLER_GET_SSE_CONTROLLER,
  CONTROLLER_GET_SSE_HANDLERS,
  CONTROLLER_GET_WS_HANDLERS,
  CONTROLLER_GET_WS_TOPICS,
  CONTROLLER_LOOKUP_SSE,
  CONTROLLER_LOOKUP_WS,
  CONTROLLER_META,
  CONTROLLER_REQUEST,
  CONTROLLER_TYPED_HANDLERS,
} from '../../constants';
import type { HTTP_METHODS, InterceptorCB, MiddlewareCB, ParamMetadata } from './common';
import type { CORSConfig } from './cors';
import type { ErrorHandler } from './error';
import type { Request } from './request';
import type { Response } from './response';
import type { SanitizerConfig } from './sanitize';
import type { RateLimitOptions } from './ratelimit';

/** Any class decorated with `@Controller`, before instantiation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControllerClass = new (...args: any[]) => any;

/** @internal Symbol-keyed contract a `@Controller`-wrapped instance implements. */
export interface IController {
  [CONTROLLER_PRECOMPILED]: ControllerMeta;
  [CONTROLLER_META]: (parent: Omit<ControllerMeta, 'controllers'>) => ControllerMeta;
  websocket?: WsControllerHandlers;
  sse?: SSEControllerHandlers;
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

/** @internal Flat per-route summary, used for introspection/tooling. */
export type ControllerMethods = {
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}[];

/** @internal Constructor + symbol-keyed contract of a compiled controller class. */
export interface ControllerType {
  [CONTROLLER_PRECOMPILED]?: ControllerMeta;
  [CONTROLLER_META]?(parent: Omit<ControllerMeta, 'controllers'>): ControllerMeta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  sse?: SSEControllerHandlers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): any;
}

/** A live, constructed controller — the instance side of {@link ControllerType}. */
export type ControllerInstance = InstanceType<ControllerType>;

/** Object form of the `@Controller` decorator's argument. */
export interface ControllerConfig {
  /** Route prefix for every route in the class, e.g. `'/users'`. */
  prefix: string;
  /** Controller-scoped middlewares, run before every route in this controller and its children. */
  middlewares?: MiddlewareCB[];
  /** Child controller instances mounted under this one. The only way to nest controllers. */
  controllers?: ControllerInstance[];
}

/** @internal One `@OnSSE` registration, before being grouped by event type. */
export interface SSE_HANDLER_META {
  type: string;
  method: string;
}

/** One `@OnWS` / `@Subscribe` registration, after being bound to its controller instance. */
export interface WsHandlerMeta {
  /** Event type (`'connection' | 'message' | 'close' | 'error'`) or topic registration. */
  type: string;
  topic?: undefined;
  /** Name of the handler method. */
  method: string;
  /** The bound handler function. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => any;
}

/** @internal A controller's compiled `@OnWS` handlers and `@Subscribe` topics, grouped by event type. */
export interface WsControllerHandlers {
  handlers: {
    connection: WsHandlerMeta[];
    message: WsHandlerMeta[];
    close: WsHandlerMeta[];
    error: WsHandlerMeta[];
  };
  topics: WsHandlerMeta[];
}

/** @internal A controller's compiled `@OnSSE` handlers, grouped by event type. */
export interface SSEControllerHandlers {
  handlers: {
    connection: WsHandlerMeta[];
    close: WsHandlerMeta[];
    error: WsHandlerMeta[];
  };
}

/** @internal Un-merged middleware lists collected from decorator metadata for one scope. */
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

/** @internal A route's middleware chain, split by kind and ready to run in pipeline order. */
export interface CompiledMiddleware {
  sanitizers: SanitizerConfig[];
  guards: (GuardClass | GuardFunction | GuardInstance)[];
  pipes: Pipe[];
  middlewares: MiddlewareCB[];
  interceptors: InterceptorCB[];
  errorHandlers: ErrorHandler[];
  cors: CORSConfig[];
  rateLimits: RateLimitOptions[];
  status?: number;
}

/** @internal One precompiled route: pattern, matcher, params, and compiled middleware. */
export interface Route {
  name: string;
  route: string;
  method: HTTP_METHODS;
  cors?: CORSConfig[];
  parameters: ParamMetadata[];
  functions: MiddlewaresMetadataItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => any;
  compiledRegex?: RegExp;
  /** `route` split into non-empty segments, precomputed for the matcher. */
  compiledSegments?: string[];
  specificity?: string;
  compiled?: CompiledMiddleware;
}

/** @internal Middleware `next()` signature: call with an error to abort the chain. */
export type NextFunction = (error?: unknown) => void;

/** @internal A controller's compiled route tree, as built by `CONTROLLER_META`. */
export interface ControllerMeta {
  prefix: string;
  name: string;
  routes: Route[];
  children?: ControllerMeta[];
  functions: MiddlewaresMetadataItem[];
  controllers: ControllerClass[];
}

/** @internal Alternate controller metadata shape used by some introspection helpers. */
export interface ControllerMetadata {
  prefix: string;
  name: string;
  middlewares: MiddlewareCB[];
  controllers: ControllerInstance[];
}

/** @internal Metadata for one route, as stored by `defineRouteMeta`. */
export interface RouteMetadata {
  route: string;
  method: HTTP_METHODS;
  middlewares: MiddlewareCB[];
  parameters: ParamMetadata[];
}

/** Which request part a {@link Pipe} function can transform. */
export type PipeKey = 'body' | 'query' | 'params' | 'headers';

/** Transformation functions accepted by the `@Pipe` decorator; see it for full semantics. */
export interface Pipe {
  /** Transforms the parsed body; its return value replaces `request.body`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: (body: any, request: Request) => any;
  /** Transforms the query object; its return value replaces `request.query`. */
  query?: (
    query: Record<string, string | string[]>,
    request: Request
  ) => Record<string, string | string[]>;
  /** Transforms the route params; its return value replaces `request.params`. */
  params?: (params: Record<string, string>, request: Request) => Record<string, string>;
  /** Transforms the headers; its return value replaces `request.headers`. */
  headers?: (
    headers: Record<string, string | string[]>,
    request: Request
  ) => Record<string, string | string[]>;
}

/** A guard implemented as a class instance, for the `@Guard` decorator. */
export interface GuardInstance {
  /** Denial message used when `canActivate` returns `false` (a returned `string` wins instead). */
  message?: string;
  /**
   * Decides whether the request may proceed.
   * @param request - The incoming request.
   * @param response - The response, for read-only context.
   * @returns `true` to allow; `false` or a denial-message `string` to reject
   *   with `ForbiddenError`.
   */
  canActivate(request: Request, response: Response): Promise<boolean> | boolean | string;
}

/** A guard implemented as a class (instantiated per request); see the `@Guard` decorator. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GuardClass = new (...args: any[]) => GuardInstance;

/** A guard implemented as a plain function; see the `@Guard` decorator. */
export type GuardFunction = (
  request: Request,
  response: Response
) => Promise<boolean | string> | boolean | string;

/** @internal Kind tag for one entry in a `MiddlewaresMetadataItem` list (enum form). */
export enum MiddlewaresMetadataItemProperty {
  middleware = 'middleware',
  errorHandler = 'errorHandler',
  cors = 'cors',
  pipe = 'pipe',
  guard = 'guard',
  interceptor = 'interceptor',
  status = 'status',
  sanitizer = 'sanitizer',
  rateLimit = 'rateLimit',
}

/**
 * @internal Kind tag for one entry pushed by a `@heliosjs/middlewares` decorator:
 * `'middleware'` (`@Use`), `'errorHandler'` (`@Catch`), `'cors'` (`@Cors`),
 * `'pipe'` (`@Pipe`), `'guard'` (`@Guard`/`@Roles`), `'interceptor'`
 * (`@Intercept`), `'status'` (`@Status`), `'sanitizer'` (`@Sanitize`),
 * `'rateLimit'` (`@RateLimit`).
 */
export type MiddleWareItemType =
  | 'middleware'
  | 'errorHandler'
  | 'cors'
  | 'pipe'
  | 'guard'
  | 'interceptor'
  | 'status'
  | 'sanitizer'
  | 'rateLimit';

/** @internal Maps each {@link MiddleWareItemType} to the value type it carries. */
interface MiddlewareTypeMap {
  middleware: MiddlewareCB;
  errorHandler: ErrorHandler;
  cors: CORSConfig;
  pipe: Pipe;
  guard: GuardClass | GuardFunction | GuardInstance;
  interceptor: InterceptorCB;
  status: number;
  sanitizer: SanitizerConfig;
  rateLimit: RateLimitOptions;
}

/**
 * @internal One tagged item in a controller/route's middleware list — exactly one
 * of its keys is set. This is what every `@heliosjs/middlewares` decorator
 * (`@Use`, `@Guard`, `@Pipe`, …) pushes via `defineMiddlewaresMeta`.
 */
export type MiddlewaresMetadataItem = {
  [K in MiddleWareItemType]?: MiddlewareTypeMap[K];
};
