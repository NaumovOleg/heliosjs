import { ParamDecoratorType } from '../../types/core';
import { defineRouteMeta } from '../shared/helpers';

export function createParamDecorator(type: ParamDecoratorType, dto?: any, name?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const data = { parameters: [{ index: parameterIndex, type, dto, name }] };
    defineRouteMeta(data, target, propertyKey);
  };
}

export const pathStartsWithPrefix = (path: string, prefix: string): boolean => {
  const pathSegments = path.split('/').filter(Boolean);
  const prefixSegments = prefix.split('/').filter(Boolean);

  if (prefixSegments.length > pathSegments.length) {
    return false;
  }

  for (let i = 0; i < prefixSegments.length; i++) {
    if (pathSegments[i] !== prefixSegments[i]) {
      return false;
    }
  }

  return true;
};
