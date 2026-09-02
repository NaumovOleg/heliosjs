import type { Meta } from '../../../types/core/common';
import type {
  ErrorDetails,
  ErrorHandlerConfig,
  ErrorObject,
  HeliosError,
} from '../../../types/core/error';
import { ErrorCode } from '../../../types/core/error';
import { UnauthorizedError } from './authorizations';
import { BaseError } from './base';
import { NotFoundError } from './notfound';

export class ApplicationError {
  private readonly config: ErrorHandlerConfig;
  code: ErrorCode;
  status: number;
  message: string;
  details?: ErrorDetails[];
  upstream?: unknown;
  timestamp: Date;
  requestId?: string;
  path?: string;
  stack?: unknown;

  constructor(
    error: ErrorObject | Error,
    data: { meta: Meta; config: ErrorHandlerConfig; status?: number }
  ) {
    this.config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
      logStack: true,
      ...(data.config ?? {}),
    };

    const appError = this.normalizeError(error, data.meta);

    if (this.config.logErrors) {
      this.logError(appError, data.meta);
    }

    this.code = appError.code;
    this.status = appError.status;
    this.message = appError.message;
    this.details = appError.details;
    this.upstream = appError.upstream;
    this.timestamp = appError.timestamp ?? new Date();
    this.requestId = data.meta.requestId;
    this.path = appError.path;
    this.stack = appError.cause?.stack?.split('\n').map((line: string) => line.trim());
  }

  private httpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 413:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      case 503:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return status >= 500 ? ErrorCode.INTERNAL_SERVER_ERROR : ErrorCode.BAD_REQUEST;
    }
  }

  private normalizeError(
    error: ErrorObject,
    request: { requestId: string; requestUrl: URL; method: string }
  ) {
    if (error instanceof BaseError) {
      return error;
    }

    const base = {
      requestId: request.requestId,
      path: request.requestUrl.pathname,
      method: request.method,
    };

    if ((error.status ?? error.statusCode) == 401) {
      return new UnauthorizedError(ErrorCode.UNAUTHORIZED, base);
    }
    if ((error.status ?? error.statusCode) == 404) {
      return new NotFoundError(request.requestUrl.pathname, request.requestId);
    }
    if ((error as any).isAxiosError || (error as any).response) {
      const httpError = error as any;
      const status = httpError.response?.status ?? 500;
      const upstream = httpError.response?.data;
      return new BaseError(
        this.httpStatusToErrorCode(status),
        httpError.message || httpError.response?.statusText || 'External API error',
        {
          status,
          cause: httpError,
          upstream,
          ...base,
        }
      );
    }

    if (error instanceof Error) {
      return new BaseError(ErrorCode.INTERNAL_SERVER_ERROR, error.message, {
        status: 500,
        cause: error,
        ...base,
      });
    }

    if (typeof error === 'string') {
      return new BaseError(ErrorCode.INTERNAL_SERVER_ERROR, error, {
        status: 500,
        ...base,
      });
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as ErrorObject;
      return new BaseError(
        (err.code as ErrorCode) || ErrorCode.INTERNAL_SERVER_ERROR,
        err.message || 'Unknown error',
        {
          status: err.status || 500,
          details: err.details,
          ...base,
        }
      );
    }

    return new BaseError(ErrorCode.INTERNAL_SERVER_ERROR, 'Unknown error', {
      status: 500,
      ...base,
    });
  }

  private formatValidationErrors(errors: ErrorObject['errors']): ErrorDetails[] | undefined {
    return errors?.map((error) => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints ? Object.values(error.constraints) : [],
      children: error.children?.length ? this.formatValidationErrors(error.children) : [],
    }));
  }

  private logError(error: HeliosError, meta: Meta): void {
    const logEntry = {
      timestamp: error.timestamp.toISOString(),
      requestId: error.requestId,
      method: error.method,
      path: error.path,
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
      stack: this.config.includeStack ? error.stack : undefined,
      ip: meta.sourceIp,
      userAgent: meta.userAgent,
    };

    if (error.status >= 500) {
      console.error(JSON.stringify(logEntry, null, 2));
    } else if (error.status >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.info(JSON.stringify(logEntry));
    }
  }

  toJSON() {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
      upstream: this.upstream,
      timestamp: this.timestamp ?? new Date(),
      requestId: this.requestId,
      path: this.path,
      stack: this.stack,
    };
  }
}
