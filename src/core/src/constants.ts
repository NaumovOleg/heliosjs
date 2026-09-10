/**
 * `Reflect.defineMetadata` keys and symbols the framework uses internally to
 * attach decorator-written config to classes/methods, and to expose
 * symbol-keyed methods on compiled controllers (see the "Architecture" section
 * of the repo's CLAUDE.md for the full picture). None of these are meant to be
 * read or written by application code — decorators and the compiler are the
 * only consumers. Documented with `@internal` so generated docs can exclude
 * them from the public API reference.
 */

/** @internal Legacy-decorator constructor-parameter-types metadata key (`design:parameters`, set by `emitDecoratorMetadata`). */
export const PARAM_METADATA_KEY = 'design:parameters';
/** @internal Unused reflect-metadata key reserved for app-level configuration. */
export const APP_METADATA_KEY = 'app:configuration';
/** @internal Unused reflect-metadata key reserved for a route's prefix. */
export const ROUTE_PREFIX = 'route:prefix';
/** @internal Unused reflect-metadata key reserved for a route's middlewares. */
export const ROUTE_MIDDLEWARES = 'route:middlewares';
/** @internal Unused reflect-metadata key reserved for a controller's middlewares (superseded by `DECORATOR.middlewares`). */
export const MIDDLEWARES = 'controller:middlewares';
/** @internal Reflect-metadata key holding a controller's child-controller classes, read by `@heliosjs/http`'s `collectControllers`. */
export const CONTROLLERS = 'app:controllers';
/** @internal Unused reflect-metadata key reserved for app-level interceptors. */
export const INTERCEPTOR = 'app:interceptors';
/** @internal Unused reflect-metadata key reserved for route endpoints. */
export const ENDPOINT = 'route:endpoints';
/** @internal Unused reflect-metadata key reserved for a success status override (superseded by `MiddlewaresMetadataItemProperty.status`). */
export const OK_METADATA_KEY = 'custom:ok';

/** @internal Reflect-metadata key holding the `@Server`/`@Port`/`@Host` merged `ServerConfig`. */
export const SERVER_CONFIG_KEY = 'server:config';
/** @internal Unused reflect-metadata key reserved for a `@Use`-style middleware marker. */
export const USE_MIDDLEWARE = 'controller:usemiddleware';

/** @internal Reflect-metadata key holding a controller's `@OnWS` handler registrations. */
export const WS_HANDLER = 'websocket:handler';
/** @internal Reflect-metadata key holding a controller's `@Subscribe` topic registrations. */
export const WS_TOPIC_KEY = 'websocket:topic';
/** @internal Unused reflect-metadata key reserved for a WebSocket service reference. */
export const WS_SERVICE_KEY = 'websocket:service';
/** @internal Unused reflect-metadata key reserved for a server-level interceptor list. */
export const INTERCEPT = 'server:intercept';
/** @internal Unused reflect-metadata key reserved for a server-level `@Catch` handler. */
export const CATCH = 'server:catch';
/** @internal Unused reflect-metadata key reserved for an action-level sanitizer. */
export const SANITIZE = 'action:sanitize';

/** @internal HTTP status codes treated as "success" (2xx minus 304) when picking a default response status. */
export const OK_STATUSES = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
/** @internal Parameter-decorator types that go through DTO/class-validator validation (see {@link ParamDecoratorType}). */
export const TO_VALIDATE = ['headers', 'params', 'multipart', 'query', 'body', 'cookies'];

/** @internal Reflect-metadata key holding a controller's `@OnSSE` handler registrations. */
export const SSE_METADATA_KEY = 'sse:handlers';
/** @internal Unused reflect-metadata key reserved for SSE topic registrations. */
export const SSE_TOPIC_KEY = 'sse:topics';
/** @internal Unused reflect-metadata key reserved for an SSE service reference. */
export const SSE_SERVICE_KEY = 'sse:service';
/** @internal Unused reflect-metadata key reserved for static-file-serving config. */
export const STATIC_METADATA_KEY = 'static:config';

/**
 * @internal The three reflect-metadata keys the framework's decorator system is
 * built on: `controller` (the `@Controller` config, read/written by
 * `defineControllerMeta`/`reflectControllerMeta`), `middlewares` (the tagged
 * `MiddlewaresMetadataItem[]` every `@heliosjs/middlewares` decorator pushes to,
 * via `defineMiddlewaresMeta`), and `route` (one route's `RouteMetadata`, via
 * `defineRouteMeta`/`reflectRouteMetadata`).
 */
export enum DECORATOR {
  controller = 'controller:config',
  middlewares = 'controller:middlewares',
  route = 'controller:route',
}

/** @internal Reflect-metadata key holding a `@GrpcService` class's service name and proto options. */
export const GRPC_SERVICE_METADATA = Symbol('grpc:service');
/** @internal Reflect-metadata key holding a class's `@GrpcMethod`/`@GrpcStreamMethod` registrations. */
export const GRPC_METHOD_METADATA = Symbol('grpc:method');
/** @internal Reflect-metadata key holding a class's `@InjectGrpcClient` constructor-parameter bindings. */
export const GRPC_CLIENT_METADATA = Symbol('grpc:client');

/** @internal Symbol-keyed method a compiled controller exposes to handle one incoming request. */
export const CONTROLLER_REQUEST = Symbol('controller:request');
/** @internal Symbol-keyed method that builds a controller's precompiled route tree from its parent's metadata. */
export const CONTROLLER_META = Symbol('controller:meta');
/** @internal Symbol-keyed method that filters a handler list down to one WS/SSE event type. */
export const CONTROLLER_TYPED_HANDLERS = Symbol('controller:typedHandlers');
/** @internal Symbol-keyed method returning a controller's compiled `@OnWS` handlers for one event type. */
export const CONTROLLER_GET_WS_HANDLERS = Symbol('controller:getWsHandlers');
/** @internal Symbol-keyed method that discovers and compiles a controller's `@OnWS`/`@Subscribe` metadata. */
export const CONTROLLER_LOOKUP_WS = Symbol('controller:lookupWs');
/** @internal Symbol-keyed method returning a controller's compiled `@Subscribe` topics. */
export const CONTROLLER_GET_WS_TOPICS = Symbol('controller:getWsTopics');
/** @internal Symbol-keyed method returning a controller's compiled `@OnSSE` handlers for one event type. */
export const CONTROLLER_GET_SSE_HANDLERS = Symbol('controller:getSseHandlers');
/** @internal Symbol-keyed method that discovers and compiles a controller's `@OnSSE` metadata. */
export const CONTROLLER_LOOKUP_SSE = Symbol('controller:lookupSse');
/** @internal Symbol-keyed method returning the controller instance + grouped SSE handlers for the SSE server to register. */
export const CONTROLLER_GET_SSE_CONTROLLER = Symbol('controller:getSseController');
/** @internal Property key under which a `@Controller`-wrapped instance stores its precompiled {@link ControllerMeta}. */
export const CONTROLLER_PRECOMPILED = Symbol('controller:precompiled');
