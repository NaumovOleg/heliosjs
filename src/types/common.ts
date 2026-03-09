/* eslint-disable @typescript-eslint/no-explicit-any */
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

type P_Q = Record<string, string | undefined> | null | unknown;

export type AppRequest<B = unknown, Q extends P_Q = unknown, P extends P_Q = unknown> = {
  method: HTTP_METHODS;
  url: URL;
  headers: IncomingHttpHeaders;
  query?: Q;
  params?: P;
  body: B;
  rawBody: Buffer<ArrayBufferLike>;
  isBase64Encoded?: boolean;
  cookies: Record<string, string>;
  _startTime: number;
};

export type Router = (
  req: AppRequest,
  res?: ServerResponse,
) => Promise<{ status: number; data: any; message?: string }>;

export type EndpointResponse<T = any> = {
  status: number;
  data?: T;
  error?: any;
};

export type AxiosQuery = {
  data?: { [key: string]: any };
  headers?: { [key: string]: any };
  params?: { [key: string]: any };
  url: string;
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE';
};

export interface IController {
  handleRequest: Router;
}

export type MiddlewareCB = (
  appRequest: AppRequest,
  request?: IncomingMessage,
  respinse?: ServerResponse,
) => Promise<AppRequest> | AppRequest;

export type InterceptorCB = (
  data: any,
  req?: IncomingMessage,
  res?: ServerResponse,
) => Promise<unknown> | unknown;

export type ErrorCB = (
  error: Error,
  req?: IncomingMessage,
  res?: ServerResponse,
) => Promise<ResponseWithStatus> | ResponseWithStatus;

export type ParamDecoratorType =
  | 'body'
  | 'params'
  | 'query'
  | 'request'
  | 'headers'
  | 'cookies'
  | 'response'
  | 'multipart'
  | 'event'
  | 'context';

export interface ParamMetadata {
  index: number;
  type: ParamDecoratorType;
  dto?: any;
  name?: string;
}

export type ResponseWithStatus = {
  status: number;
  [key: string]: any;
};

export enum HTTP_METHODS {
  USE = 'USE',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  PUT = 'PUT',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}
