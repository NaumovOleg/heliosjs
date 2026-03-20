import { IRequest } from './request';
import { IResponse } from './response';

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INVALID_STATE = 'INVALID_STATE',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  [key: string]: any;
}

export interface AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: ErrorDetails[];
  timestamp: Date;
  requestId?: string;
  path?: string;
  method?: string;
  toResponse(): ErrorResponse;
}

export interface IValidationError extends AppError {
  code: ErrorCode.VALIDATION_FAILED;
  details?: ErrorDetails[];
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    status: number;
    message: string;
    details?: ErrorDetails[];
    timestamp: string;
    requestId?: string;
    path?: string;
  };
}

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  logStack?: boolean;
  customHandlers?: Record<ErrorCode, (error: AppError) => any>;
}
export interface SerializedError {
  type: 'Error' | 'HttpError' | 'AxiosError' | 'Unknown' | 'ValidationError';
  message: string;
  status?: number;
  code?: string;
  stack?: string;
  data?: any;
  original?: any;
  errors?: any[];
  details?: ErrorDetails[];
}

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  logStack?: boolean;
  customHandlers?: Record<ErrorCode, (error: AppError) => any>;
}

export type ErorrHandler = (error: Error, req: IRequest, response: IResponse) => any;
