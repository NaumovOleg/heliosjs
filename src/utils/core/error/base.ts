import {
  ErrorCode,
  ErrorDetails,
  ErrorObject,
  ErrorResponse,
  HeliosError,
} from '../../../types/core/error';

export class BaseError extends Error implements HeliosError {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: ErrorDetails[];
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly path?: string;
  public readonly method?: string;
  cause?: ErrorObject;
  name: string;
  message: string = '';
  stack?: string | undefined;
  toResponse(): ErrorResponse {
    throw new Error('Method not implemented.');
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
    },
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
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.INTERNAL_ERROR:
      default:
        return 500;
    }
  }
}
