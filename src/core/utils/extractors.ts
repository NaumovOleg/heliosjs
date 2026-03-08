import { PARAM_METADATA_KEY } from '@constants';
import { ParamDecoratorType } from '@types';

export interface ParamMetadata {
  index: number;
  type: ParamDecoratorType;
  dto?: any;
  name?: string;
}

function createParamDecorator(type: ParamDecoratorType, dto?: any, name?: string) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingParams: ParamMetadata[] =
      Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey) || [];

    existingParams.push({ index: parameterIndex, type, dto, name });
    existingParams.sort((a, b) => a.index - b.index);

    Reflect.defineMetadata(PARAM_METADATA_KEY, existingParams, target, propertyKey);

    const saved = Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey);
  };
}

export const Body = (dto?: any) => createParamDecorator('body', dto);
export const Params = (name?: string) => createParamDecorator('params', undefined, name);
export const Query = (name?: string) => createParamDecorator('query', undefined, name);
export const Request = () => createParamDecorator('request');
export const Headers = (name?: string) => createParamDecorator('headers', undefined, name);
export const Cookies = (name?: string) => createParamDecorator('cookies', undefined, name);
export const Multipart = (name?: string) => createParamDecorator('multipart', undefined, name);
export const Response = () => createParamDecorator('response');