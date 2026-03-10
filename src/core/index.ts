/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
export {
  AppRequest,
  EndpointResponse,
  ErrorCB,
  HttpError,
  IController,
  InterceptorCB,
  IWebSocketService,
  MiddlewareCB,
  ResponseWithStatus,
  Router,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '@types';
export * from './Controller';
export * from './Endpoint';
export * from './utils';
