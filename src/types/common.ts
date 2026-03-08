/* eslint-disable @typescript-eslint/no-explicit-any */
import { IncomingHttpHeaders, ServerResponse } from 'http';

type P_Q = Record<string, string | undefined> | null | unknown;

export type Request<B = unknown, Q extends P_Q = unknown, P extends P_Q = unknown> = {
  method: string;
  url: URL;
  headers: IncomingHttpHeaders;
  query?: Q;
  params?: P;
  body: B;
  isBase64Encoded?: boolean;
};
export type Router = (
  req: Request,
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

export type Middleware = (req: Request, res?: ServerResponse) => Promise<Request> | Request;
export type Interceptor = (
  data: any,
  req?: Request,
  res?: ServerResponse,
) => Promise<unknown> | unknown;

export type ParamDecoratorType =
  | 'body'
  | 'params'
  | 'query'
  | 'request'
  | 'headers'
  | 'cookies'
  | 'response'
  | 'multipart';

export interface ParamMetadata {
  index: number;
  type: ParamDecoratorType;
  dto?: any;
  name?: string;
}
