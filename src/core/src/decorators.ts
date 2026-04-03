import { createParamDecorator } from './utils/core';

/**
 * Parameter decorator to extract and validate the request body from an incoming HTTP request.
 *
 * This decorator can optionally accept a Data Transfer Object (DTO) class to validate and transform the
 * incoming request body into a strongly typed object.
 *
 * @param {unknown} [dto] - Optional DTO class used for validation and transformation of the request body.
 *
 * @example
 * ```ts
 * // Without DTO validation
 * @Body() body: any
 *
 * // With DTO validation
 * class UserDto {
 *   name: string;
 *   age: number;
 * }
 *
 * @Body(UserDto) user: UserDto
 * ```
 */
export const Body = (dto?: unknown) => createParamDecorator('body', dto);

/**
 * Parameter decorator to extract route parameters from the URL path.
 *
 * This decorator supports optional DTO validation and allows extracting a specific parameter by name.
 *
 * @param {unknown} [dto] - Optional DTO class for validation and transformation of route parameters.
 * @param {string} [name] - Optional specific parameter name to extract from the route parameters.
 *
 * @example
 * ```ts
 * // Extract all route parameters as an object
 * @Params() params: any
 *
 * // Extract a specific route parameter by name
 * @Params('id') id: string
 *
 * // Validate and transform route parameters using a DTO
 * class UserParamsDto {
 *   id: string;
 * }
 *
 * @Params(UserParamsDto) params: UserParamsDto
 * ```
 */
export const Params = (dto?: unknown, name?: string) =>
  createParamDecorator(
    'params',
    typeof dto == 'string' ? undefined : dto,
    typeof dto == 'string' ? dto : name,
  );

/**
 * Parameter decorator to extract query parameters from the URL.
 *
 * This decorator supports optional DTO validation and allows extracting a specific query parameter by name.
 *
 * @param {unknown} [dto] - Optional DTO class for validation and transformation of query parameters.
 * @param {string} [name] - Optional specific query parameter name to extract.
 *
 * @example
 * ```ts
 * // Extract all query parameters as an object
 * @Query() query: any
 *
 * // Extract a specific query parameter by name
 * @Query('search') search: string
 *
 * // Validate and transform query parameters using a DTO
 * class SearchDto {
 *   search: string;
 * }
 *
 * @Query(SearchDto) query: SearchDto
 * ```
 */
export const Query = (dto?: unknown, name?: string) =>
  createParamDecorator(
    'query',
    typeof dto == 'string' ? undefined : dto,
    typeof dto == 'string' ? dto : name,
  );

/**
 * Parameter decorator to inject the HTTP request object into a controller method.
 *
 * This allows direct access to the raw request object for advanced use cases.
 *
 * @example
 * ```ts
 * @Req() req: Request
 * ```
 */
export const Req = () => createParamDecorator('request');

/**
 * Parameter decorator to extract HTTP headers from the incoming request.
 *
 * This decorator supports extracting all headers or a specific header by name.
 *
 * @param {string} [name] - Optional name of the header to extract.
 *
 * @example
 * ```ts
 * // Extract all headers as an object
 * @Headers() headers: Headers
 *
 * // Extract a specific header by name
 * @Headers('authorization') authHeader: string
 * ```
 */
export const Headers = (name?: string) => createParamDecorator('headers', undefined, name);

/**
 * Parameter decorator to extract cookies from the incoming HTTP request.
 *
 * This decorator supports extracting all cookies or a specific cookie by name.
 *
 * @param {string} [name] - Optional name of the cookie to extract.
 *
 * @example
 * ```ts
 * // Extract all cookies as an object
 * @Cookies() cookies: any
 *
 * // Extract a specific cookie by name
 * @Cookies('sessionId') sessionId: string
 * ```
 */
export const Cookies = (name?: string) => createParamDecorator('cookies', undefined, name);

/**
 * Parameter decorator to extract multipart form data from the incoming request.
 *
 * This decorator supports extracting all multipart fields or a specific field by name.
 *
 * @param {string} [name] - Optional name of the multipart field to extract.
 *
 * @example
 * ```ts
 * // Extract all multipart form data
 * @Files() multipartData: any
 *
 * // Extract a specific file field
 * @Files('file') file: File
 * ```
 */
export const Files = (name?: string) => createParamDecorator('multipart', undefined, name);

/**
 * Parameter decorator to inject the HTTP response object into a controller method.
 *
 * This allows direct access to the raw response object for advanced use cases.
 *
 * @example
 * ```ts
 * @Res() res: Response
 * ```
 */
export const Res = () => createParamDecorator('response');
