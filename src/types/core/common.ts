import { ServerResponse } from 'http';
import { AppError } from './error';
import { IRequest } from './request';
import { IResponse } from './response';

export type Router = (
  req: IRequest,
  res?: ServerResponse,
) => Promise<{ status: number; data: any; message?: string }>;

export interface IController {
  handleRequest: Router;
}

export type MiddlewareCB = (
  request: IRequest,
  response: IResponse,
  next: (args?: any) => any,
) => void | Promise<IRequest> | IRequest | Promise<void> | void;

export type InterceptorCB = (
  data: any,
  req?: IRequest,
  res?: IResponse,
) => Promise<unknown> | unknown;

export type ErrorCB = (error: AppError, req?: IRequest, res?: IResponse) => any;

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
  | 'context'
  | 'sse'
  | 'ws';

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
  ANY = 'ANY',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  PUT = 'PUT',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

export type Meta = {
  requestUrl: URL;
  method: string;
  requestId: string;
  sourceIp: string;
  userAgent: string;
  startTime: number;
};
