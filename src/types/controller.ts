import { ErrorCB, HTTP_METHODS, InterceptorCB, MiddlewareCB } from './common';
import { CORSConfig } from './cors';

export type ControllerClass = { new (...args: any[]): any };
export type ControllerInstance = InstanceType<ControllerClass>;

export type ControllerMethods = Array<{
  name: string;
  httpMethod: HTTP_METHODS;
  pattern: string;
  middlewares?: MiddlewareCB[];
}>;

export type ControllerMetadata = {
  routePrefix: string;
  middlewares: MiddlewareCB[];
  interceptor?: InterceptorCB;
  subControllers: ControllerClass[];
  errorHandler?: ErrorCB;
  cors?: CORSConfig;
};

export interface ControllerConfig {
  prefix: string;
  middlewares?: Array<MiddlewareCB>;
  controllers?: ControllerClass[];
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
};
