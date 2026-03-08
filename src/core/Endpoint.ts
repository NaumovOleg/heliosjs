import { ENDPOINT } from '@constants';
import { Middleware } from '@types';

/**
 * Method decorator to define HTTP method and route pattern metadata on controller methods.
 *
 * This decorator maps a controller method to an HTTP endpoint by specifying the HTTP method
 * (e.g., GET, POST) and an optional route pattern.
 *
 * It also allows attaching middlewares that will be applied when the endpoint is accessed.
 *
 * @param method - The HTTP method (e.g., 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'USE').
 * @param pathPattern - Optional route pattern string to match the endpoint path.
 * @param middlewares - Optional array of middlewares to apply to this endpoint.
 *
 * @returns A method decorator function.
 */
export function Endpoint(method: string, pathPattern?: string, middlewares?: Middleware[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      console.warn('❌ originalMethod is undefined!');
      return descriptor;
    }

    if (method && pathPattern) {
      Reflect.defineMetadata(ENDPOINT, [method, pathPattern], target, propertyKey);
      Reflect.defineMetadata('middlewares', middlewares || [], target, propertyKey);
    }

    return descriptor;
  };
}

/**
 * Shortcut decorator for HTTP GET method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for GET endpoint.
 */
export const GET = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('GET', pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP POST method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for POST endpoint.
 */
export const POST = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('POST', pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP PUT method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for PUT endpoint.
 */
export const PUT = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('PUT', pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP PATCH method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for PATCH endpoint.
 */
export const PATCH = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('PATCH', pathPattern, middlewares);
};

/**
 * Shortcut decorator for HTTP DELETE method.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for DELETE endpoint.
 */
export const DELETE = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('DELETE', pathPattern, middlewares);
};

/**
 * Shortcut decorator for middleware usage on routes.
 *
 * @param pathPattern - Optional route pattern string.
 * @param middlewares - Optional array of middlewares.
 * @returns Method decorator for middleware usage.
 */
export const USE = (pathPattern?: string, middlewares?: Middleware[]) => {
  return Endpoint('USE', pathPattern, middlewares);
};
