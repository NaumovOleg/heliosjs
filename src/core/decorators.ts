import { createParamDecorator } from '@utils';

/**
 * Parameter decorator to extract and validate the request body.
 * @param dto Optional DTO class for validation and transformation.
 */
export const Body = (dto?: any) => createParamDecorator('body', dto);

/**
 * Parameter decorator to extract route parameters.
 * @param name Optional name of the parameter to extract.
 */
export const Params = (dto?: any, name?: string) =>
  createParamDecorator(
    'params',
    typeof dto == 'string' ? undefined : dto,
    typeof dto == 'string' ? dto : name,
  );

/**
 * Parameter decorator to extract query parameters.
 * @param name Optional name of the query parameter to extract.
 */
export const Query = (dto?: any, name?: string) =>
  createParamDecorator(
    'query',
    typeof dto == 'string' ? undefined : dto,
    typeof dto == 'string' ? dto : name,
  );

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
