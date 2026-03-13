import { ValidationError } from 'class-validator';
interface SerializedError {
  type: 'Error' | 'HttpError' | 'AxiosError' | 'Unknown' | 'ValidationError';
  message: string;
  status?: number;
  code?: string;
  stack?: string;
  data?: any;
  original?: any;
  errors?: any[];
}

function formatValidationError(error: ValidationError): any {
  const result: any = {
    property: error.property,
    value: error.value,
  };

  if (error.constraints) {
    result.constraints = Object.values(error.constraints);
  }

  if (error.children && error.children.length > 0) {
    result.children = formatValidationErrors(error.children);
  }

  return result;
}

function formatValidationErrors(errors: ValidationError[]): any[] {
  return errors.map((error) => formatValidationError(error));
}

export function serializeError(error: any): SerializedError {
  if (Array.isArray(error) && error.length > 0 && error[0] instanceof ValidationError) {
    return {
      type: 'ValidationError',
      message: 'Validation failed',
      status: 400,
      errors: formatValidationErrors(error),
      original: error,
    };
  }
  if (error?.isAxiosError || error?.response) {
    return {
      type: 'AxiosError',
      message: error.message || error.response?.statusText || 'Axios error',
      status: error.response?.status ?? 500,
      code: error.code,
      data: error.response?.data,
      stack: error.stack,
      original: error,
    };
  }

  if (error?.status || error?.statusCode) {
    return {
      type: 'HttpError',
      message: error.message ?? 'HTTP error',
      status: error.status ?? error.statusCode ?? 500,
      code: error.code,
      data: error.data,
      stack: error.stack,
      original: error,
    };
  }

  if (error instanceof Error) {
    return {
      type: 'Error',
      message: error.message,
      stack: error.stack,
      original: error,
      status: 500,
    };
  }

  return {
    type: 'Unknown',
    message: typeof error === 'string' ? error : 'Unknown error',
    original: error,
    status: 500,
  };
}

export function isError(value: any): boolean {
  if (value === null || value === undefined) return false;

  if (value instanceof Error) return true;

  if (typeof value === 'object') {
    if (value.status || value.statusCode) return true;

    if (typeof value.message === 'string' && value.message.length > 0) return true;

    if (value.code) return true;

    if (value.response) return true;

    if (value.isAxiosError === true) return true;

    if (value.name && ['Error', 'TypeError', 'RangeError', 'SyntaxError'].includes(value.name)) {
      return true;
    }
  }

  if (typeof value === 'string' && value.length > 0) return true;

  if (typeof value === 'number') return true;

  return false;
}

export function getErrorType(error: any): {
  isError: boolean;
  type: 'Error' | 'HttpError' | 'AxiosError' | 'String' | 'Number' | 'Object' | 'Unknown' | null;
  confidence: 'high' | 'medium' | 'low';
} {
  const value = error?.data ?? error?.error ?? error?.err ?? error;
  if (value === null || value === undefined) {
    return { isError: false, type: null, confidence: 'high' };
  }

  if (value instanceof Error) {
    return { isError: true, type: 'Error', confidence: 'high' };
  }

  if (value.isAxiosError === true || value.response) {
    return { isError: true, type: 'AxiosError', confidence: 'high' };
  }

  if (value.status || value.statusCode) {
    return { isError: true, type: 'HttpError', confidence: 'high' };
  }

  if (typeof value === 'object' && typeof value.message === 'string') {
    return { isError: true, type: 'Object', confidence: 'medium' };
  }

  return { isError: false, type: null, confidence: 'high' };
}
