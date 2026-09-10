import type {
  ErrorDetails,
  ErrorObject,
  ErrorResponse,
  HeliosError,
} from '../../../types/core/error';
import { ErrorCode } from '../../../types/core/error';

/**
 * Base class for every Helios error. Extends the native `Error` and implements
 * {@link HeliosError}: it carries a machine-readable `code`, an HTTP `status`,
 * optional structured `details`, request context (`requestId`, `path`, `method`),
 * a `timestamp`, and an optional `upstream` payload from a failed downstream call.
 *
 * Throw a `BaseError` (or one of its subclasses such as {@link NotFoundError})
 * anywhere in the request pipeline and the adapter turns it into a structured
 * error response via {@link BaseError.toResponse}. Prefer the specific subclasses;
 * use `BaseError` directly only for a code/status combination none of them cover.
 *
 * @example
 * throw new BaseError(ErrorCode.BAD_REQUEST, 'Unsupported currency', {
 *   status: 422,
 *   details: [{ field: 'currency', value: 'XYZ' }],
 * });
 */
export class BaseError extends Error implements HeliosError {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: ErrorDetails[];
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly path?: string;
  public readonly method?: string;
  public readonly upstream?: unknown;
  cause?: ErrorObject;
  name: string;
  message = '';
  stack?: string | undefined;
  /**
   * Serializes the error to the wire shape adapters send to clients:
   * `{ success: false, error: { code, status, message, details?, timestamp,
   * requestId?, path? } }`.
   */
  toResponse(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        status: this.status,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        path: this.path,
      },
    };
  }
  /**
   * @param code - Machine-readable {@link ErrorCode} — one of `BAD_REQUEST`,
   *   `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`,
   *   `RATE_LIMIT_EXCEEDED`, `SERVICE_UNAVAILABLE`, `DATABASE_ERROR`,
   *   `DUPLICATE_ENTRY`, `INVALID_STATE`, `DEPENDENCY_FAILED`,
   *   `PAYLOAD_TOO_LARGE`, `INTERNAL_SERVER_ERROR`. Why: lets clients branch on a
   *   stable identifier instead of parsing the message.
   * @param message - Human-readable description; becomes `error.message`.
   * @param options - Extra context:
   *   - `status` — HTTP status to respond with. Defaults from `code`
   *     (`BAD_REQUEST`/`VALIDATION_FAILED`→400, `UNAUTHORIZED`→401,
   *     `FORBIDDEN`→403, `NOT_FOUND`→404, `PAYLOAD_TOO_LARGE`→413,
   *     `RATE_LIMIT_EXCEEDED`→429, everything else→500).
   *   - `details` — array of `{ field?, value?, constraint?, … }` for field-level
   *     errors. Why: structured client-side rendering.
   *   - `requestId` / `path` / `method` — request context, usually filled by the
   *     framework, echoed back in the response for tracing.
   *   - `cause` — the original `Error` that triggered this one. Why: keep the
   *     stack for logs without leaking it to the client.
   *   - `upstream` — raw payload from a failed downstream service. Why: debugging
   *     third-party failures.
   */
  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      status?: number;
      details?: ErrorDetails[];
      requestId?: string;
      path?: string;
      method?: string;
      cause?: Error;
      upstream?: unknown;
    }
  ) {
    super(message);
    this.name = 'HeliosError';
    this.code = code;
    this.status = options?.status || this.getDefaultStatus(code);
    this.details = options?.details;
    this.timestamp = new Date();
    this.requestId = options?.requestId;
    this.path = options?.path;
    this.method = options?.method;
    this.message = message;
    this.upstream = options?.upstream;

    if (options?.cause) {
      this.cause = options.cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultStatus(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.BAD_REQUEST:
      case ErrorCode.VALIDATION_FAILED:
        return 400;
      case ErrorCode.UNAUTHORIZED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.PAYLOAD_TOO_LARGE:
        return 413;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return 500;
    }
  }
}
