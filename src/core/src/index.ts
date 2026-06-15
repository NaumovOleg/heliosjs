/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
import 'reflect-metadata';

export * from './Controller';
export * from './constants';
export * from './decorators';
export * from './Endpoint';
export {
  CORSConfig,
  ControllerClass,
  ControllerType,
  ErrorHandler,
  FingerprintComponent,
  FingerprintConfig,
  GuardClass,
  GuardFunction,
  GuardInstance,
  HeliosError,
  HTTP_METHODS,
  InterceptorCB,
  ISSEService,
  MiddlewareCB,
  MultipartFile,
  Pipe,
  RBACConfig,
  Request,
  RolesExtractor,
  Response,
  SanitizerConfig,
} from './types/core';

export { IWebSocketServer, IWebSocketService, WebSocketEvent } from './types/ws';

export {
  computeFingerprint,
  DEFAULT_COMPONENTS,
  DependencyFailedError,
  DuplicateEntryError,
  ForbiddenError,
  getFingerprintConfig,
  getOrComputeFingerprint,
  getRolesExtractor,
  InternalServerError,
  InvalidStateError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitExceededError,
  SANITIZER,
  ServiceUnavailableError,
  setFingerprintConfig,
  setRolesExtractor,
  UnauthorizedError,
  ValidationError,
} from './utils/core';
