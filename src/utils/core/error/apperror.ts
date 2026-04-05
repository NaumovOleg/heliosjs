import { Meta } from '../../../types/core/common';
import {
  ErrorCode,
  ErrorDetails,
  ErrorHandlerConfig,
  ErrorObject,
  HeliosError,
} from '../../../types/core/error';
import { UnauthorizedError } from './authorizations';
import { BaseError } from './base';
import { NotFoundError } from './notfound';
import { ValidationError } from './validation';

export class ApplicationError {
  private config: ErrorHandlerConfig;
  code: ErrorCode;
  status: number;
  message: string;
  details?: ErrorDetails[];
  timestamp: Date;
  requestId?: string;
  path?: string;
  stack?: unknown;

  constructor(
    error: ErrorObject | Error,
    data: { meta: Meta; config: ErrorHandlerConfig; status?: number },
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
    this.message = appError.code;
    this.details = appError.details;
    this.timestamp = appError.timestamp ?? new Date();
    this.requestId = data.meta.requestId;
    this.path = appError.path;
    this.details = appError.details;
    this.stack = appError.cause?.stack?.split('\n').map((line: string) => line.trim());
  }

  private normalizeError(
    error: ErrorObject,
    request: { requestId: string; requestUrl: URL; method: string },
  ) {
    if (error instanceof BaseError) {
      return error;
    }

    if (error?.errors) {
      const details = this.formatValidationErrors(error?.errors);
      return new ValidationError(details!, request);
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
        },
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
      children: error.children?.length ? this.formatValidationErrors(error.children) : undefined,
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
      message: this.code,
      details: this.details,
      timestamp: this.timestamp ?? new Date(),
      requestId: this.requestId,
      path: this.path,
      stack: this.stack,
    };
  }
}
