import { ServerResponse } from 'http';
import { HeliosError } from './error';
import { Request } from './request';
import { Response } from './response';

export type Router = (
  req: Request,
  res?: ServerResponse,
) => Promise<{ status: number; data: unknown; message?: string }>;

export interface IController {
  handleRequest: Router;
}

export type MiddlewareCB = (
  request: Request,
  response: Response,
  next: (err?: HeliosError) => unknown | void | undefined,
) => void | Promise<Request> | Request | Promise<void> | void;

export type InterceptorCB = (
  data: unknown,
  req?: Request,
  res?: Response,
) => Promise<unknown> | unknown;

export type ErrorCB = (error: HeliosError, req?: Request, res?: Response) => unknown;

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
  dto?: unknown;
  name?: string;
}

export type ResponseWithStatus = {
  status: number;
  [key: string]: unknown;
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
