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

/**
 * Parameter decorator to extract and validate the request body.
 * @param dto Optional DTO class for validation and transformation.
 */
export const Body = (dto?: any) => createParamDecorator('body', dto);

/**
 * Parameter decorator to extract route parameters.
 * @param name Optional name of the parameter to extract.
 */
export const Params = (name?: string) => createParamDecorator('params', undefined, name);

/**
 * Parameter decorator to extract query parameters.
 * @param name Optional name of the query parameter to extract.
 */
export const Query = (name?: string) => createParamDecorator('query', undefined, name);

/**
 * Parameter decorator to inject the entire request object.
 */
export const Request = () => createParamDecorator('request');

/**
 * Parameter decorator to extract headers from the request.
 * @param name Optional name of the header to extract.
 */
export const Headers = (name?: string) => createParamDecorator('headers', undefined, name);

/**
 * Parameter decorator to extract cookies from the request.
 * @param name Optional name of the cookie to extract.
 */
export const Cookies = (name?: string) => createParamDecorator('cookies', undefined, name);

/**
 * Parameter decorator to extract multipart form data.
 * @param name Optional name of the multipart field to extract.
 */
export const Multipart = (name?: string) => createParamDecorator('multipart', undefined, name);

/**
 * Parameter decorator to inject the response object.
 */
export const Response = () => createParamDecorator('response');
