/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MiddleWareItemType, MiddlewaresMetadataItem, Request } from '../../types/core';
import type { InterceptorCB, MiddlewareCB } from '../../types/core/common';
import { MultipartProcessor } from './multipart';

export const normalizePath = (path: string): string => {
  if (!path) return '/';
  const withoutQuery = path.split('?')[0];
  return (
    '/' +
    withoutQuery
      .split('/')
      .filter(p => p.length > 0)
      .join('/')
  );
};

export const getParams = (fullRoutePattern: string, actualPath: string): Record<string, string> => {
  const normalizedPattern = normalizePath(fullRoutePattern);
  const normalizedPath = normalizePath(actualPath);
  const patternSegments = normalizedPattern.split('/').filter(s => s.length > 0);
  const pathSegments = normalizedPath.split('/').filter(s => s.length > 0);

  const hasWildcard = patternSegments[patternSegments.length - 1] === '*';
  const effectivePatternCount = hasWildcard ? patternSegments.length - 1 : patternSegments.length;

  if (!hasWildcard && patternSegments.length !== pathSegments.length) {
    return {};
  }
  if (hasWildcard && pathSegments.length < effectivePatternCount) {
    return {};
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < effectivePatternCount; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];

    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      return {};
    }
  }

  if (hasWildcard) {
    params['*'] = pathSegments.slice(effectivePatternCount).join('/');
  }

  return params;
};

export function buildRoutePattern(parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function mergeMiddlewares(...middlewareLists: MiddlewareCB[][]): MiddlewareCB[] {
  return middlewareLists.flat();
}

export function mergeInterceptors(...interceptorLists: InterceptorCB[][]): InterceptorCB[] {
  return interceptorLists.flat();
}

export function isClass(obj: any): boolean {
  return typeof obj === 'function' && /^class\s/.test(Function.prototype.toString.call(obj));
}

export const getBodyAndMultipart = (request: Request) => {
  let body = request.body;
  let multipart;
  if (MultipartProcessor.isMultipart(request)) {
    const { fields, files } = MultipartProcessor.parse({
      body: request.rawBody || request.body,
      headers: request.headers,
      isBase64Encoded: request.isBase64Encoded,
    });
    multipart = files;
    body = fields;
  }

  return { multipart, body };
};

export const extractMiddlewares = <T extends MiddleWareItemType>(
  fns: MiddlewaresMetadataItem[],
  fnType: T,
) => {
  return (
    fns
      .filter(fn => !!fn[fnType])
      .map(fn => fn[fnType])
      .filter(Boolean) ?? []
  );
};
