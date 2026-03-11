/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
export {
  AppRequest,
  CORSConfig,
  EndpointResponse,
  ErrorCB,
  HttpError,
  IController,
  InterceptorCB,
  IWebSocketService,
  MiddlewareCB,
  MultipartFile,
  ResponseWithStatus,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '@types';
export * from './Controller';
export * from './decorators';
export * from './Endpoint';
