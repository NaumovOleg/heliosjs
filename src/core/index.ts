/**
 * Re-exports core decorators and types related to controllers and endpoints.
 *
 * This module provides centralized exports for controller and endpoint decorators,
 * as well as related types and utility functions used throughout the core framework.
 */
export {
  EndpointResponse,
  IController,
  Interceptor,
  Middleware,
  Request,
  Router,
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '@types';
export * from './Controller';
export * from './Endpoint';
export * from './utils';
