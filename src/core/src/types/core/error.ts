import type { Request } from './request';
import type { Response } from './response';

/**
 * Machine-readable identifier carried by every {@link HeliosError}, letting
 * clients branch on a stable value instead of parsing messages. See the
 * concrete error classes (`ForbiddenError`, `NotFoundError`, …) in
 * `@heliosjs/core` for the one matching each code, and `BaseError`'s
 * `getDefaultStatus` for the HTTP status each maps to when not overridden:
 * - `BAD_REQUEST` (400), `VALIDATION_FAILED` (400) — malformed / invalid input;
 * - `UNAUTHORIZED` (401) — missing/invalid credentials;
 * - `FORBIDDEN` (403) — authenticated but not permitted;
 * - `NOT_FOUND` (404) — resource / route does not exist;
 * - `PAYLOAD_TOO_LARGE` (413) — request body over the configured limit;
 * - `RATE_LIMIT_EXCEEDED` (429) — `@RateLimit` breach;
 * - `DUPLICATE_ENTRY` (409) — uniqueness constraint violated;
 * - `INVALID_STATE` (409) — operation invalid for current state / misconfiguration;
 * - `DEPENDENCY_FAILED` (424) — a downstream call failed;
 * - `SERVICE_UNAVAILABLE` (503) — temporarily unable to serve;
 * - `DATABASE_ERROR` (500) — persistence layer failure;
 * - `INTERNAL_SERVER_ERROR` (500) — unexpected failure.
 */
export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INVALID_STATE = 'INVALID_STATE',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/** One field-level error, as carried in `HeliosError.details` / `ValidationError`. */
export interface ErrorDetails {
  /** Name of the offending field, if applicable. */
  field?: string;
  /** The value that failed, if safe to echo back. */
  value?: unknown;
  /** Which rule was violated (e.g. `'min length 3'`). */
  constraint?: string;
  /** Additional structured context. */
  [key: string]: unknown;
}

/** Contract every Helios error class (see `BaseError`) implements. */
export interface HeliosError extends Error {
  /** Machine-readable identifier; see {@link ErrorCode}. */
  code: ErrorCode;
  /** HTTP status to respond with. */
  status: number;
  /** Field-level detail, when applicable. */
  details?: ErrorDetails[];
  /** When the error was created. */
  timestamp: Date;
  /** Correlation id of the request that produced this error. */
  requestId?: string;
  /** Request path, when known. */
  path?: string;
  /** Request method, when known. */
  method?: string;
  /** Serializes to the wire-format {@link ErrorResponse}. */
  toResponse(): ErrorResponse;
}

/** A {@link HeliosError} narrowed to the validation-failure case (`ValidationError`). */
export interface IValidationError extends HeliosError {
  code: ErrorCode.VALIDATION_FAILED;
  details?: ErrorDetails[];
}

/** JSON body sent to clients for any Helios error, from `HeliosError.toResponse()`. */
export interface ErrorResponse {
  /** Always `false` — lets clients discriminate success vs error bodies. */
  success: false;
  error: {
    /** Machine-readable identifier; see {@link ErrorCode}. */
    code: ErrorCode;
    /** HTTP status sent. */
    status: number;
    /** Human-readable message. */
    message: string;
    /** Field-level detail, when applicable. */
    details?: ErrorDetails[];
    /** ISO-8601 timestamp. */
    timestamp: string;
    /** Correlation id, for support/tracing. */
    requestId?: string;
    /** Request path, when known. */
    path?: string;
  };
}

/** Options controlling how `ApplicationError` normalizes and logs a thrown value. */
export interface ErrorHandlerConfig {
  /** Include the stack trace in the normalized error. Default: `true` outside production. */
  includeStack?: boolean;
  /** Log every normalized error via the global logger. Default `true`. */
  logErrors?: boolean;
  /** Include the stack trace specifically in the log line (independent of `includeStack`). */
  logStack?: boolean;
  /** Per-`ErrorCode` overrides for producing a custom response shape. */
  customHandlers?: Record<ErrorCode, (error: HeliosError) => unknown>;
}

/** Normalized shape produced by `serializeError` for logging/diagnostics. */
export interface SerializedError {
  /** Which branch of `serializeError` classified this error. */
  type: 'Error' | 'HttpError' | 'AxiosError' | 'Unknown' | 'ValidationError';
  /** Human-readable message. */
  message: string;
  /** HTTP status, when known. */
  status?: number;
  /** Machine-readable code, when known. */
  code?: string;
  /** Stack trace, when available. */
  stack?: string;
  /** Extra payload (e.g. an Axios response body). */
  data?: unknown;
  /** The original, un-normalized error/value. */
  original?: unknown;
  /** Per-field errors, for `type: 'ValidationError'`. */
  errors?: unknown[];
  /** Structured detail, when available. */
  details?: ErrorDetails[];
}

/**
 * `@Catch` handler signature. Return a value to answer the request with it;
 * return or throw an `Error` to defer to the next handler (or the default error
 * response if none remain). May be async.
 *
 * @param error - The thrown value.
 * @param req - The request being handled.
 * @param response - The response, for header/status tweaks before returning data.
 */
export type ErrorHandler = (error: Error, req: Request, response: Response) => unknown;

/** One class-validator error node (a field's own failure, or nested `children`). */
interface ErrorChildren {
  property?: string;
  value: unknown;
  constraints?: unknown[];
  children?: ErrorChildren[];
}

/**
 * Loose shape accepted anywhere a thrown value is normalized (`ApplicationError`,
 * `serializeError`) — covers a `BaseError`, a plain `Error`, an HTTP-client error,
 * or a class-validator error array, without requiring a specific class.
 */
export type ErrorObject = Partial<{
  name: string;
  status: number;
  statusCode: number;
  code: string;
  message: string;
  stack: string;
  errors: ErrorChildren[];
  details: ErrorDetails[];
}>;
