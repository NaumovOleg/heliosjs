/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
export {
  AppError,
  CORSConfig,
  ErrorCB,
  InterceptorCB,
  IRequest,
  IResponse,
  IWebSocketService,
  MiddlewareCB,
  MultipartFile,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '@types';
export { SANITIZER } from '@utils';
export * from './Controller';
export * from './decorators';
export * from './Endpoint';
