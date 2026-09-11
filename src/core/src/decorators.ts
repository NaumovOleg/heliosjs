import type { ValidatorOptions } from 'class-validator';
import type { Dto } from './types';
import { createParamDecorator } from './utils/core';
import { defineMiddlewaresMeta } from './utils/shared';
import type { RateLimitOptions } from './types/core/ratelimit';

/**
 * Parameter decorator that injects the parsed request body into a handler argument.
 *
 * The three parameters are positional but each accepts more than one shape, so the
 * decorator can be called in several ways:
 *
 * - `@Body()` — inject the whole body as-is, with no validation.
 * - `@Body(UserDto)` — run the body through the DTO class (class-transformer
 *   `plainToInstance` + class-validator, or the DTO's static `from()` method if it
 *   defines one) and inject the resulting instance. A failed check throws
 *   `ValidationError` (HTTP 400) before the handler runs.
 * - `@Body('email')` — inject only `body.email`. Combine with a DTO
 *   (`@Body(UserDto, 'email')`) to validate first, then pick one field.
 * - `@Body(UserDto, { whitelist: true })` — pass class-validator options.
 *
 * @param nameOrDto - Either the name of a single body field to extract (`string`),
 *   or a DTO class to validate and transform the whole body against. Why: one
 *   decorator covers "give me the raw body", "give me a typed, validated object",
 *   and "give me just this field" without extra decorators.
 * @param nameOrOptions - When `nameOrDto` was a DTO, this is either the field name
 *   to extract after validation (`string`) or a class-validator `ValidatorOptions`
 *   object. Why: lets you both narrow the result and tune validation in one call.
 * @param options - class-validator `ValidatorOptions` (`whitelist`,
 *   `forbidNonWhitelisted`, `skipMissingProperties`, `groups`, …). Applied only
 *   when a DTO class is supplied. Why: per-endpoint control over strictness.
 *
 * @example
 * class CreateUserDto {
 *   @IsString() name!: string;
 *   @IsInt() age!: number;
 * }
 *
 * @Post('/users')
 * create(@Body(CreateUserDto) dto: CreateUserDto) {}
 *
 * @Post('/echo')
 * echo(@Body() raw: unknown) {}
 *
 * @Post('/name')
 * rename(@Body('name') name: string) {}
 */
export const Body = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('body', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects the route (path) parameters — the `:id`,
 * `:slug` etc. segments and, for a trailing wildcard route, the `*` capture.
 *
 * Call shapes match {@link Body}:
 * - `@Params()` — inject all params as `Record<string, string>`.
 * - `@Params('id')` — inject only `params.id`. Use `@Params('*')` to get the
 *   remainder captured by a trailing `*` in the route pattern.
 * - `@Params(ParamsDto)` — validate/transform the whole params object; throws
 *   `ValidationError` (HTTP 400) on failure. Useful for coercing `:id` to a
 *   number or enforcing a UUID shape before the handler runs.
 *
 * @param nameOrDto - Name of a single path parameter to extract (`string`), or a
 *   DTO class to validate the whole params object against. Why: path params
 *   arrive as strings; a DTO is the place to coerce and constrain them.
 * @param nameOrOptions - Field name to extract after DTO validation (`string`),
 *   or class-validator `ValidatorOptions`.
 * @param options - class-validator `ValidatorOptions`, applied only with a DTO.
 *
 * @example
 * @Get('/users/:id')
 * getUser(@Params('id') id: string) {}
 *
 * @Get('/files/*')
 * serve(@Params('*') rest: string) {}
 */
export const Params = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('params', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects the URL query string, parsed into an object.
 * Repeated keys (`?tag=a&tag=b`) become a `string[]`; everything else is a
 * `string`.
 *
 * Call shapes match {@link Body}:
 * - `@QueryParam()` — inject all query params as
 *   `Record<string, string | string[]>`.
 * - `@QueryParam('search')` — inject only `query.search`.
 * - `@QueryParam(SearchDto)` — validate/transform the whole query object; throws
 *   `ValidationError` (HTTP 400) on failure. The place to coerce `page` to a
 *   number, apply defaults, or reject unknown filters.
 *
 * @param nameOrDto - Name of a single query key to extract (`string`), or a DTO
 *   class to validate the whole query object against.
 * @param nameOrOptions - Field name to extract after DTO validation (`string`),
 *   or class-validator `ValidatorOptions`.
 * @param options - class-validator `ValidatorOptions`, applied only with a DTO.
 *
 * @example
 * class ListDto {
 *   @Type(() => Number) @IsInt() @Min(1) page = 1;
 * }
 *
 * @Get('/posts')
 * list(@QueryParam(ListDto) q: ListDto) {}
 */
export const QueryParam = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('query', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects the framework {@link Request} object, giving
 * the handler the full API: `getState`/`setState`, `getClientIp()`, `isSecure()`,
 * `getCookie()`, the raw Node request via `raw`, and the Lambda event/context on
 * serverless. Reach for this only when a targeted decorator
 * (`@Body`, `@QueryParam`, …) does not cover the need.
 *
 * @example
 * @Get('/me')
 * me(@Req() req: Request) {
 *   return { ip: req.getClientIp(), user: req.getState('user') };
 * }
 */
export const Req = () => createParamDecorator('request');

/**
 * Parameter decorator that injects request headers. Header lookup by name is
 * case-insensitive.
 *
 * Call shapes match {@link Body}:
 * - `@Headers()` — inject all headers as `Record<string, string | string[]>`.
 * - `@Headers('authorization')` — inject only that header's value.
 * - `@Headers(HeadersDto)` — validate/transform the whole header set; throws
 *   `ValidationError` (HTTP 400) on failure. Use to require and shape headers
 *   such as `x-api-version` or `x-tenant-id`.
 *
 * @param nameOrDto - Header name to extract (`string`, case-insensitive), or a
 *   DTO class to validate the whole header set against.
 * @param nameOrOptions - Field name to extract after DTO validation (`string`),
 *   or class-validator `ValidatorOptions`.
 * @param options - class-validator `ValidatorOptions`, applied only with a DTO.
 *
 * @example
 * @Get('/secure')
 * secure(@Headers('authorization') auth: string) {}
 */
export const Headers = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('headers', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects request cookies, parsed from the `Cookie`
 * header into a `Record<string, string>`.
 *
 * Call shapes match {@link Body}:
 * - `@Cookies()` — inject all cookies as `Record<string, string>`.
 * - `@Cookies('sessionId')` — inject only `cookies.sessionId`.
 * - `@Cookies(CookiesDto)` — validate/transform the whole cookie set; throws
 *   `ValidationError` (HTTP 400) on failure.
 *
 * @param nameOrDto - Cookie name to extract (`string`), or a DTO class to
 *   validate the whole cookie set against.
 * @param nameOrOptions - Field name to extract after DTO validation (`string`),
 *   or class-validator `ValidatorOptions`.
 * @param options - class-validator `ValidatorOptions`, applied only with a DTO.
 *
 * @example
 * @Get('/session')
 * session(@Cookies('sessionId') sid: string) {}
 */
export const Cookies = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('cookies', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects uploaded files from a
 * `multipart/form-data` request body.
 *
 * The value is keyed by form field name; a field is a single {@link MultipartFile}
 * or, when the client sent several files under one name, a `MultipartFile[]`.
 * Non-file fields of the same form are delivered separately through `@Body()`.
 * Each `MultipartFile` carries `fieldname`, `filename`, `contentType`, `data`
 * (a `Buffer`), `size`, and `encoding`.
 *
 * Call shapes match {@link Body}:
 * - `@Files()` — inject the whole map, `Record<string, MultipartFile | MultipartFile[]>`.
 * - `@Files('avatar')` — inject only the `avatar` field.
 * - `@Files(FilesDto)` — validate the map against a DTO (e.g. require `avatar`).
 *
 * @param nameOrDto - Form field name to extract (`string`), or a DTO class to
 *   validate the whole file map against.
 * @param nameOrOptions - Field name to extract after DTO validation (`string`),
 *   or class-validator `ValidatorOptions`.
 * @param options - class-validator `ValidatorOptions`, applied only with a DTO.
 *
 * @example
 * @Post('/upload')
 * upload(@Files('file') file: MultipartFile, @Body('title') title: string) {
 *   return { name: file.filename, bytes: file.size };
 * }
 */
export const Files = (
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) => createParamDecorator('multipart', nameOrDto, nameOrOptions, options);

/**
 * Parameter decorator that injects the framework {@link Response} object for
 * cases the return-value convention cannot express: setting cookies
 * (`res.setCookie`), custom headers, redirects (`res.redirect`), or streaming.
 *
 * Normally a handler just returns its payload and Helios serialises it — only
 * take `@Res()` when you need to touch the response directly. Writing to the
 * response yourself suppresses the automatic serialization of the return value.
 *
 * @example
 * @Get('/download')
 * download(@Res() res: Response) {
 *   res.setHeader('Content-Type', 'text/csv');
 *   return 'a,b,c\n1,2,3';
 * }
 */
export const Res = () => createParamDecorator('response');

/**
 * Parameter decorator that injects the request fingerprint.
 *
 * The value is computed lazily from the configured components (default:
 * ip + User-Agent + Accept-Language) and cached in request state, so it works
 * whether or not `@UseFingerprint()` ran first.
 *
 * @example
 * getData(@Fingerprint() fp: string) {}
 */
export const Fingerprint = () => createParamDecorator('fingerprint');

/**
 * Method or controller decorator that enforces a request rate limit. On breach
 * the request is rejected with `RateLimitExceededError` (HTTP 429) and
 * `Retry-After` / `X-RateLimit-*` response headers are set.
 *
 * `max` and `windowMs` are validated at decoration time (a non-positive value
 * throws `TypeError`). Enforcement runs per request. Method-level usage overrides
 * controller-level, which overrides the global defaults set via
 * `setRateLimitConfig`. The limit key defaults to the request fingerprint
 * (ip + User-Agent + Accept-Language), so unauthenticated clients are still
 * bucketed.
 *
 * @param options - Rate-limit configuration:
 *   - `max` (**required**) — maximum requests (or token cost units) permitted per
 *     window. Must be `> 0`. Why: the ceiling you are protecting.
 *   - `windowMs` (**required**) — window length in milliseconds. Must be `> 0`.
 *     Why: `max` per `windowMs` is the rate.
 *   - `strategy` — limiting algorithm: `fixedWindow()` (default, hard reset each
 *     window), `slidingWindow()` (smooths boundary bursts), or
 *     `tokenBucket({ refillRate })` (allows bursts up to `max`). Pass a
 *     store-backed strategy (e.g. Redis) to share counts across instances.
 *   - `keyGen` — `(req) => string` to derive the bucket key (e.g. per user id
 *     instead of per fingerprint). Why: choose what "a client" means.
 *   - `onLimit` — `(req, res) => void | Promise<void>` hook fired on breach
 *     before the 429 is thrown; a throw inside it is swallowed. Why: logging,
 *     metrics, alerting.
 *   - `cost` — units this route consumes per hit (default `1`). Why: make
 *     expensive endpoints drain the budget faster.
 *
 * @throws {TypeError} When `max` or `windowMs` is not a positive number.
 *
 * @example
 * @RateLimit({ max: 100, windowMs: 60_000 })                       // 100/min
 * @RateLimit({ max: 10, windowMs: 1000, strategy: slidingWindow(redisStore) })
 * @RateLimit({ max: 20, windowMs: 60_000, keyGen: (r) => r.getState('userId') ?? r.getClientIp() })
 */
export function RateLimit(options: RateLimitOptions) {
  if (!(options.max > 0)) {
    throw new TypeError('@RateLimit: `max` must be a positive number');
  }
  if (!(options.windowMs > 0)) {
    throw new TypeError('@RateLimit: `windowMs` must be a positive number');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string) {
    const item = { rateLimit: options };
    if (propertyKey) {
      defineMiddlewaresMeta([item], target, propertyKey);
    } else {
      defineMiddlewaresMeta([item], target);
    }
  };
}
