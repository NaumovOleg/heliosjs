import type { ServerResponse } from 'node:http';
import type { ValidationOptions } from 'class-validator';
import type { HeliosError } from './error';
import type { Request } from './request';
import type { Response } from './response';

export type Router = (
  req: Request,
  res?: ServerResponse
) => Promise<{ status: number; data: unknown; message?: string }>;

export type MiddlewareCB<
  B = unknown,
  Q = Record<string, string | string[]>,
  P = Record<string, string>
> = (
  request: Request<B, Q, P>,
  response: Response,
  next: (err?: HeliosError) => Promise<any> | any
) => void | Promise<Request> | Request | Promise<void>;

export type InterceptorCB<
  B = any,
  Q = Record<string, string | string[]>,
  P = Record<string, string>
> = (data: unknown, req?: Request<B, Q, P>, res?: Response) => Promise<unknown> | unknown;

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
  | 'ws'
  | 'fingerprint';

export interface ParamMetadata {
  index: number;
  type: ParamDecoratorType;
  dto?: unknown;
  name?: string;
  options?: ValidationOptions;
}

export interface ResponseWithStatus {
  status: number;
  [key: string]: unknown;
}

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

export interface Meta {
  requestUrl: URL;
  method: string;
  requestId: string;
  sourceIp: string;
  userAgent: string;
  startTime: number;
}

export type NonEmptyArray<T> = readonly [T, ...T[]] | [T, ...T[]];
