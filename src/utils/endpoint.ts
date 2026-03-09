import { PARAM_METADATA_KEY } from '@constants';
import { ParamMetadata, ParamDecoratorType } from '@types';

export function createParamDecorator(type: ParamDecoratorType, dto?: any, name?: string) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingParams: ParamMetadata[] =
      Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey) || [];

    existingParams.push({ index: parameterIndex, type, dto, name });
    existingParams.sort((a, b) => a.index - b.index);

    Reflect.defineMetadata(PARAM_METADATA_KEY, existingParams, target, propertyKey);

    const saved = Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey);
  };
}
