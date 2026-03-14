/* eslint-disable @typescript-eslint/no-explicit-any */
import { InterceptorCB, MiddlewareCB } from '@types';
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  pattern = pattern.replace(/^\/+|\/+$/g, '');
  path = path.replace(/^\/+|\/+$/g, '');

  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  const params: Record<string, string> = {};

  let i = 0;
  let j = 0;

  while (i < patternSegments.length && j < pathSegments.length) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[j];

    if (patternSegment === '*') {
      params['*'] = pathSegments.slice(j).join('/');
      return params;
    }

    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
      i++;
      j++;

      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }

    i++;
    j++;
  }

  while (i < patternSegments.length) {
    const patternSegment = patternSegments[i];

    if (patternSegment === '*') {
      params['*'] = '';
      i++;
    } else if (patternSegment.startsWith(':')) {
      return null;
    } else {
      return null;
    }
  }

  if (j < pathSegments.length) {
    return null;
  }

  return Object.keys(params).length > 0 ? params : {};
}

export function buildRoutePattern(parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function mergeMiddlewares(...middlewareLists: MiddlewareCB[][]): MiddlewareCB[] {
  return middlewareLists.flat();
}

export function mergeInterceptors(...interceptorLists: InterceptorCB[][]): InterceptorCB[] {
  return interceptorLists.flat();
}
