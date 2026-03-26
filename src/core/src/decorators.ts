import { createParamDecorator } from './utils/core';

/**
 * Parameter decorator to extract and validate the request body.
 *
 * @param {any} [dto] - Optional DTO class for validation and transformation.
 *
 * Usage:
 * ```ts
 * @Body() body: any
 * @Body(UserDto) user: UserDto
 * ```
 */
export const Body = (dto?: unknown) => createParamDecorator('body', dto);

/**
 * Parameter decorator to extract route parameters.
 *
 * @param {any} [dto] - Optional DTO class for validation and transformation.
 * @param {string} [name] - Optional name of the parameter to extract.
 *
 * Usage:
 * ```ts
 * @Params() params: any
 * @Params('id') id: string
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
 * Parameter decorator to extract query parameters.
 *
 * @param {any} [dto] - Optional DTO class for validation and transformation.
 * @param {string} [name] - Optional name of the query parameter to extract.
 *
 * Usage:
 * ```ts
 * @Query() query: any
 * @Query('search') search: string
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
 * Parameter decorator to inject the entire request object.
 *
 * Usage:
 * ```ts
 * @Req() req: Request
 * ```
 */
export const Req = () => createParamDecorator('request');

/**
 * Parameter decorator to extract headers from the request.
 *
 * @param {string} [name] - Optional name of the header to extract.
 *
 * Usage:
 * ```ts
 * @Headers() headers: Headers
 * @Headers('authorization') authHeader: string
 * ```
 */
export const Headers = (name?: string) => createParamDecorator('headers', undefined, name);

/**
 * Parameter decorator to extract cookies from the request.
 *
 * @param {string} [name] - Optional name of the cookie to extract.
 *
 * Usage:
 * ```ts
 * @Cookies() cookies: any
 * @Cookies('sessionId') sessionId: string
 * ```
 */
export const Cookies = (name?: string) => createParamDecorator('cookies', undefined, name);

/**
 * Parameter decorator to extract multipart form data.
 *
 * @param {string} [name] - Optional name of the multipart field to extract.
 *
 * Usage:
 * ```ts
 * @Files() multipartData: any
 * @Files('file') file: File
 * ```
 */
export const Files = (name?: string) => createParamDecorator('multipart', undefined, name);

/**
 * Parameter decorator to inject the response object.
 *
 * Usage:
 * ```ts
 * @Response() res: Response
 * ```
 */
export const Res = () => createParamDecorator('response');
