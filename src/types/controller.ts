import { IncomingMessage, ServerResponse } from 'http';
import { AppRequest, ErrorCB, HTTP_METHODS, InterceptorCB, MiddlewareCB } from './common';

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
  appRequest: AppRequest;
  request?: IncomingMessage;
  response?: ServerResponse;
  middlewareChain: MiddlewareCB[];
  interceptorChain: InterceptorCB[];
  subPath: string;
};
