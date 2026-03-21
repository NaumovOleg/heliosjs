/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
export * from './Controller';
export * from './decorators';
export * from './Endpoint';
export {
  AppError,
  CORSConfig,
  ErrorCB,
  InterceptorCB,
  MiddlewareCB,
  MultipartFile,
  Request,
  Response,
  SanitizerConfig,
} from './types/core';
export { SANITIZER } from './utils/core';
