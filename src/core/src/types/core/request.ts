import type { IncomingHttpHeaders } from 'http';

/** Where a request originated: a Node HTTP server, an AWS Lambda event, an Azure Functions invocation, or unknown. */
export type RequestSource = 'http' | 'lambda' | 'azure' | 'unknown';

/**
 * Recognized AWS event shapes (used when `source` is `'lambda'`):
 * - `'apigateway'` — API Gateway REST API (v1);
 * - `'apigatewayv2'` — API Gateway HTTP API (v2);
 * - `'alb'` — Application Load Balancer;
 * - `'cloudfront'` — CloudFront (Lambda@Edge);
 * - `'s3'`, `'sns'`, `'sqs'`, `'dynamodb'` — non-HTTP event sources;
 * - `'unknown'` — none of the above.
 */
export type EventType =
  | 'apigateway' // REST API v1
  | 'apigatewayv2' // HTTP API v2
  | 'alb' // Application Load Balancer
  | 'cloudfront' // CloudFront
  | 's3' // S3 Event
  | 'sns' // SNS Event
  | 'sqs' // SQS Event
  | 'dynamodb' // DynamoDB Stream
  | 'unknown';

/**
 * Everything needed to construct a {@link Request}. Adapters build this from the
 * transport payload; also the accepted shape of `request.clone(overrides)`.
 */
export interface RequestOptions {
  /** HTTP method (upper-case). */
  method: string;
  /** Parsed request URL. */
  requestUrl: URL;
  /** Raw URL string including query. */
  url: string;
  /** Path portion only, normalized (leading slash, no trailing slash). */
  path: string;
  /** Header map; values may be a string or a string array. */
  headers: Record<string, string | string[]>;
  /** Parsed query string; repeated keys become arrays. */
  query: Record<string, string | string[]>;
  /** Parsed body (JSON object, string, Buffer, or multipart fields). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  /** Route params extracted from the matched path pattern. */
  params: Record<string, string>;
  /** Parsed `Cookie` header. */
  cookies: Record<string, string>;
  /** Client IP as seen by the transport (before `trustProxy` resolution). */
  sourceIp?: string;
  /** `User-Agent` header value. */
  userAgent?: string;
  /** Correlation id; generated when the transport does not supply one. */
  requestId: string;
  /** API Gateway stage / deployment stage, when applicable. */
  stage?: string;
  /** Receipt time. */
  timestamp: Date;
  /** Underlying transport object (Node `IncomingMessage`, etc.). */
  raw?: unknown;
  /** Lambda `Context`, when `source` is `'lambda'`. */
  context?: unknown;
  /** Undecoded body bytes, kept for multipart parsing. */
  rawBody?: unknown;
  /** Original Lambda event, when `source` is `'lambda'`. */
  event?: unknown;
  /** Whether `body` is base64-encoded (Lambda binary payloads). */
  isBase64Encoded?: boolean;
  /** Request origin; see {@link RequestSource}. */
  source: RequestSource;
  /**
   * Trust `X-Forwarded-For` / `X-Forwarded-Proto` when resolving
   * `getClientIp()` / `isSecure()`. Default `false` — enable only behind a proxy
   * you control, since these headers are client-spoofable and feed rate limiting
   * and fingerprinting.
   */
  trustProxy?: boolean;
}

/**
 * The transport-agnostic request object handed to middlewares, guards, pipes, and
 * (via `@Req()`) handlers. The same shape whether the app runs on `node:http`,
 * AWS Lambda, or a test harness. Generics type the parsed `body` (`B`), `query`
 * (`Q`), and route `params` (`P`) so DTO-validated fields stay typed downstream.
 */
export interface Request<
  B = unknown,
  Q = Record<string, string | string[]>,
  P = Record<string, string>
> {
  /** HTTP method, upper-case (`'GET'`, `'POST'`, …). */
  method: string;
  /** Normalized path (leading slash, no trailing slash, no query). */
  path: string;
  /** Full request target string, including the query. */
  url: string;
  /** Parsed URL — use for `pathname`, `searchParams`, etc. */
  requestUrl: URL;
  /** Header map; a value is a string, or a string array for repeated headers. Prefer {@link Request.getHeader}. */
  headers: Record<string, string | string[]>;
  /** Parsed query string. Repeated keys are arrays. Reshaped by `@Pipe({ query })`. */
  query: Q;
  /** Parsed request body. Shape depends on content type and any `@Body(Dto)`. */
  body: B;
  /** Route parameters from the matched pattern (`:id` → `params.id`; trailing `*` → `params['*']`). */
  params: P;
  /** Parsed cookies. Prefer {@link Request.getCookie}. */
  cookies: Record<string, string>;
  /** Client IP as reported by the transport. For a proxy-aware value use {@link Request.getClientIp}. */
  sourceIp: string;
  /** `User-Agent` header, or `''`. */
  userAgent: string;
  /** Correlation id; echoed in the `X-Request-Id` response header and error bodies. */
  requestId: string;
  /** Deployment stage (API Gateway), or `''`. */
  stage: string;
  /** Time the request was received. */
  timestamp: Date;
  /** Origin of the request; see {@link RequestSource}. */
  source: RequestSource;
  /** Underlying transport object (Node `IncomingMessage`, etc.). Escape hatch. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  /** Lambda `Context` when running serverless, else `undefined`. */
  context: unknown;
  /** Undecoded body bytes, retained for multipart parsing. */
  rawBody: unknown;
  /** `true` when `body` arrived base64-encoded (Lambda binary). */
  isBase64Encoded: boolean;
  /** High-resolution start time, for measuring handler duration. */
  startTime: number;
  /**
   * Aborts when the underlying connection is gone before a response was
   * sent (client navigated away, timed out, or dropped the connection) —
   * `undefined` off `node:http` (Lambda has no live connection to abort on).
   * Pass straight through to anything that accepts one (`fetch`, most DB
   * drivers) to stop wasted work once nobody is listening for the result;
   * lazily wired up on first access, so requests that never read this pay
   * nothing for it.
   */
  readonly signal: AbortSignal | undefined;

  /**
   * Returns one header's value (case-insensitive), or `undefined`.
   * @param name - Header name.
   */
  getHeader(name: string): string | string[] | undefined;

  /**
   * Returns one cookie's value, or `undefined`.
   * @param name - Cookie name.
   */
  getCookie(name: string): string | undefined;

  /**
   * Returns one query parameter, or `undefined`. Array for repeated keys.
   * @param name - Query key.
   */
  getQuery(name: string): string | string[] | undefined;

  /**
   * Returns one route parameter, or `undefined`.
   * @param name - Parameter name (without the `:`).
   */
  getParam(name: string): string | undefined;

  /** `true` when the request came from a Node HTTP server. */
  isHttp(): boolean;
  /** `true` when the request came from an AWS Lambda event. */
  isLambda(): boolean;
  /** `true` when the request came from an Azure Functions invocation. */
  isAzure(): boolean;

  /** The raw Lambda event, or `undefined` off Lambda. */
  getLambdaEvent(): unknown;
  /** The Lambda `Context`, or `undefined` off Lambda. */
  getLambdaContext(): unknown;

  /** The raw Azure Functions `HttpRequest`, or `undefined` off Azure. */
  getAzureRequest(): unknown;
  /** The Azure Functions `InvocationContext`, or `undefined` off Azure. */
  getAzureContext(): unknown;

  /** The raw Node request headers, or `undefined` off `node:http`. */
  getHttpRequest(): IncomingHttpHeaders | undefined;

  /**
   * Stores a value on the request for later pipeline stages (auth user, tenant,
   * timing marks). Why: the standard way to pass data from a guard/middleware to
   * the handler.
   * @param key - State key.
   * @param value - Any value.
   */
  setState(key: string, value: unknown): void;
  /**
   * Reads a value set by {@link Request.setState}, typed as `T`.
   * @param key - State key.
   */
  getState<T>(key: string): T | undefined;
  /** Returns the whole per-request state map. */
  getAllState(): Map<string, unknown>;

  /**
   * `true` when the request is HTTPS — honors `X-Forwarded-Proto` only when
   * `trustProxy` is enabled.
   */
  isSecure(): boolean;
  /**
   * Best-effort client IP. Uses the left-most `X-Forwarded-For` entry when
   * `trustProxy` is enabled, otherwise the socket address. Feeds rate limiting
   * and fingerprinting.
   */
  getClientIp(): string;
  /** The `Host` header (authority) for this request. */
  getHost(): string;
  /** The fully-qualified URL (`scheme://host/path?query`). */
  getFullUrl(): string;

  /**
   * Returns a shallow copy with the given fields overridden. Why: build a
   * modified request for a sub-pipeline without mutating the original.
   * @param overrides - Fields to replace.
   */
  clone(overrides?: Partial<RequestOptions>): Request;

  /** Plain-object view of the request, for logging/serialization. */
  toJSON(): Record<string, this>;
}

/**
 * @internal Compile-time contract every adapter's `RequestFactory` class
 * conforms to: a static `create(...)` that builds a {@link Request} from
 * that transport's own raw event shape. `TArgs` is deliberately per-adapter
 * (`@heliosjs/http`'s `create` takes `(req, maxBytes?, trustProxy?, skipBody?)`;
 * `@heliosjs/aws`'s takes `(event, context, trustProxy?)`; `@heliosjs/azure`'s
 * takes the same as aws but returns a `Promise` since Azure's body read is
 * async) — this only pins down the return type and that `create` exists,
 * catching a future adapter forgetting to return a real `Request` (or
 * renaming/dropping `create`) as a type error instead of a silent surprise.
 * `create` is `static`, so a normal `implements` doesn't apply (TS only
 * checks instance members that way) — each adapter instead assigns its class
 * to a locally-scoped `const` typed as `IRequestFactory<...>`, which type-
 * checks the static side by assignment. No runtime behavior comes from this;
 * the three factories' actual normalization logic stays adapter-specific.
 */
export interface IRequestFactory<TArgs extends unknown[]> {
  create(...args: TArgs): Request | Promise<Request>;
}
