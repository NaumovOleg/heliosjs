import type { ValidatorOptions } from 'class-validator';
import type { Dto, ParamDecoratorType } from '../../types/core';
import { defineRouteMeta } from '../shared/helpers';

export function createParamDecorator(
  type: ParamDecoratorType,
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions,
) {
  return function (target: any, propertyKey: string, index: number) {
    const param = { index, type };
    if (options) {
      Object.assign(param, { options });
    }
    if (nameOrDto) {
      Object.assign(
        param,
        typeof nameOrDto === 'string' ? { name: nameOrDto } : { dto: nameOrDto },
      );
    }

    if (nameOrOptions) {
      Object.assign(
        param,
        typeof nameOrOptions === 'string' ? { name: nameOrOptions } : { options: nameOrOptions },
      );
    }
    const data = { parameters: [param] };
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
