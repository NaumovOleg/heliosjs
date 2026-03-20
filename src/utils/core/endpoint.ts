import { PARAM_METADATA_KEY } from '../../constants';
import { ParamDecoratorType, ParamMetadata } from '../../types/core';

export function createParamDecorator(type: ParamDecoratorType, dto?: any, name?: string) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingParams: ParamMetadata[] =
      Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey) || [];

    existingParams.push({ index: parameterIndex, type, dto, name });
    existingParams.sort((a, b) => a.index - b.index);

    Reflect.defineMetadata(PARAM_METADATA_KEY, existingParams, target, propertyKey);
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
