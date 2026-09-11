import type { CORSConfig } from '@heliosjs/core/types';
import { HTTP_METHODS } from '@heliosjs/core/types';
import { defineMiddlewaresMeta } from '@heliosjs/core/utils';
/**
 * Configures Cross-Origin Resource Sharing for a controller class or a single
 * route method. On a preflight (`OPTIONS`) request the response is answered
 * directly with the negotiated CORS headers and `optionsSuccessStatus`; on a
 * real request a disallowed origin is rejected with HTTP 403.
 *
 * Unspecified keys fall back to: `origin: '*'`, `optionsSuccessStatus: 204`,
 * `methods:` every HTTP method Helios knows.
 *
 * @param config - CORS options (all optional):
 *   - `origin` — `string`, `string[]`, or `(origin) => boolean`. `'*'` allows
 *     any origin; a list allows exact matches; a function decides per request.
 *     Why: the allow-list is the core of the policy.
 *   - `methods` — allowed methods for `Access-Control-Allow-Methods`, e.g.
 *     `['GET', 'POST']`. Why: advertise only what the route group supports.
 *   - `allowedHeaders` — value for `Access-Control-Allow-Headers` (request
 *     headers the browser may send). Why: without this, custom headers like
 *     `Authorization` are blocked on cross-origin calls.
 *   - `exposedHeaders` — response headers JS may read
 *     (`Access-Control-Expose-Headers`). Why: e.g. expose `X-Total-Count`.
 *   - `credentials` — when `true`, sets `Access-Control-Allow-Credentials: true`
 *     so cookies / `Authorization` are sent. Why: required for cookie auth;
 *     cannot be combined with `origin: '*'` per the spec.
 *   - `maxAge` — seconds a browser may cache the preflight result. Why: fewer
 *     `OPTIONS` round-trips.
 *   - `optionsSuccessStatus` — status for a successful preflight (default `204`;
 *     use `200` for legacy browsers that choke on 204).
 *
 * @returns A class or method decorator.
 *
 * @example
 * @Cors({
 *   origin: ['https://app.example.com'],
 *   methods: ['GET', 'POST'],
 *   credentials: true,
 * })
 * class ApiController {}
 */
export function Cors(config: CORSConfig = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const defaultConfig: CORSConfig = {
      origin: '*',
      optionsSuccessStatus: 204,
      methods: Object.keys(HTTP_METHODS),
    };

    const finalConfig = { ...defaultConfig, ...config };

    const data = [{ cors: finalConfig }];

    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
  };
}
