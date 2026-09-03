import type {
  ErrorDetails,
  ErrorObject,
  ErrorResponse,
  HeliosError,
} from '../../../types/core/error';
import { ErrorCode } from '../../../types/core/error';

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
