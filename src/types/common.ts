/* eslint-disable @typescript-eslint/no-explicit-any */
import { IncomingMessage, ServerResponse } from 'http';
import { LambdaRequestMeta } from './lambda';
import { MultipartFile } from './multipart';

export interface HttpError extends Error {
  statusCode?: number;
  status: number;
  data?: any;
  messages?: string[];
  errors?: Array<{ message: string }>;
}

type Request = {
  requestUrl: URL;
  method: HTTP_METHODS;
  path?: string;
  headers: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  body: any;
  rawBody: Buffer<ArrayBufferLike>;
  isBase64Encoded?: boolean;
  cookies: Record<string, string>;
  multipart?: Record<string, MultipartFile | MultipartFile[]>;
  _startTime: number;
  end: () => any;
};

export type AppRequest = Request & (IncomingMessage | LambdaRequestMeta);
export type HttpRequest = Request & IncomingMessage;

export type Router = (
  req: AppRequest,
  res?: ServerResponse,
) => Promise<{ status: number; data: any; message?: string }>;

export type EndpointResponse<T = any> = {
  status: number;
  data?: T;
  error?: any;
};

export interface IController {
  handleRequest: Router;
}

export type MiddlewareCB = (
  request: AppRequest,
  response: ServerResponse,
  next: (args?: any) => any,
) => void | Promise<AppRequest> | AppRequest | Promise<void> | void;

export type InterceptorCB = (
  data: any,
  req?: AppRequest,
  res?: ServerResponse,
) => Promise<unknown> | unknown;

export type ErrorCB = (error: HttpError, req?: AppRequest, res?: ServerResponse) => any;

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

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  priority?: 'Low' | 'Medium' | 'High';
  partitioned?: boolean;
}
