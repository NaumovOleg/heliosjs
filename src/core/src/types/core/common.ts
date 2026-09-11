import type { ServerResponse } from 'node:http';
import type { ValidationOptions } from 'class-validator';
import type { HeliosError } from './error';
import type { Request } from './request';
import type { Response } from './response';

/** Internal: low-level router signature (request in, `{ status, data }` out). */
export type Router = (
  req: Request,
  res?: ServerResponse
) => Promise<{ status: number; data: unknown; message?: string }>;

/**
 * A middleware callback. Runs before the route handler; call `next()` to continue
 * or `next(err)` to abort with an error. Not calling `next` still advances the
 * pipeline once the callback resolves. The optional generics type the request's
 * `body` (`B`), `query` (`Q`), and `params` (`P`).
 *
 * @param request - The framework {@link Request} (mutable — middlewares may set
 *   `request.setState(...)` or reshape `body`/`query`).
 * @param response - The framework {@link Response}; write to it to short-circuit.
 * @param next - Advance the chain; pass a {@link HeliosError} to reject.
 */
export type MiddlewareCB<
  B = unknown,
  Q = Record<string, string | string[]>,
  P = Record<string, string>
> = (
  request: Request<B, Q, P>,
  response: Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next: (err?: HeliosError) => Promise<any> | any
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => void | Promise<Request> | Request | Promise<void>;

/**
 * An interceptor callback. Runs *after* the handler; its return value replaces
 * the response payload. Multiple interceptors run innermost-first (the one
 * nearest the handler executes first). May be async.
 *
 * @param data - The value the handler (or the previous interceptor) returned.
 * @param req - The request, for context.
 * @param res - The response, for headers/status tweaks.
 * @returns The new payload.
 */
export type InterceptorCB<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  B = any,
  Q = Record<string, string | string[]>,
  P = Record<string, string>
> = (data: unknown, req?: Request<B, Q, P>, res?: Response) => Promise<unknown> | unknown;

/** Error-callback signature (see the richer {@link ErrorHandler} used by `@Catch`). */
export type ErrorCB = (error: HeliosError, req?: Request, res?: Response) => unknown;

/**
 * Identifies what a parameter decorator injects. Set internally by
 * `createParamDecorator`; each value maps to one decorator:
 * `'body'` (`@Body`), `'params'` (`@Params`), `'query'` (`@QueryParam`),
 * `'request'` (`@Req`), `'headers'` (`@Headers`), `'cookies'` (`@Cookies`),
 * `'response'` (`@Res`), `'multipart'` (`@Files`), `'event'` / `'context'`
 * (Lambda event/context), `'sse'` (`@InjectSSE`), `'ws'` (`@InjectWS`),
 * `'fingerprint'` (`@Fingerprint`).
 */
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

/** Internal: one handler-parameter binding recorded by a parameter decorator. */
export interface ParamMetadata {
  /** Zero-based position in the handler's argument list. */
  index: number;
  /** What to inject; see {@link ParamDecoratorType}. */
  type: ParamDecoratorType;
  /** DTO class to validate/transform the value against, if any. */
  dto?: unknown;
  /** Single field name to extract from the resolved value, if any. */
  name?: string;
  /** class-validator options applied when `dto` is set. */
  options?: ValidationOptions;
}

/** An object whose `status` field carries an explicit HTTP status code. */
export interface ResponseWithStatus {
  status: number;
  [key: string]: unknown;
}

/**
 * HTTP methods Helios routes. Values equal their names.
 * - `ANY` — matches every method (used by `@Any`);
 * - `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD` — the standard verbs;
 * - `QUERY` — a safe, idempotent method that carries a request body (the payload
 *   is read from the body, not the URL).
 */
export enum HTTP_METHODS {
  ANY = 'ANY',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  PUT = 'PUT',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
  QUERY = 'QUERY',
}

/** Minimal request context used by the error logger/serializer. */
export interface Meta {
  /** Full request URL. */
  requestUrl: URL;
  /** HTTP method. */
  method: string;
  /** Correlation id echoed back in responses and logs. */
  requestId: string;
  /** Resolved client IP. */
  sourceIp: string;
  /** `User-Agent` header. */
  userAgent: string;
  /** `performance.now()`-style start timestamp, for duration measurement. */
  startTime: number;
}

/** An array guaranteed to hold at least one element. */
export type NonEmptyArray<T> = readonly [T, ...T[]] | [T, ...T[]];
