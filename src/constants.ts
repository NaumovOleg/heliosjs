export const PARAM_METADATA_KEY = 'design:parameters';
export const APP_METADATA_KEY = 'app:configuration';
export const ROUTE_PREFIX = 'route:prefix';
export const ROUTE_MIDDLEWARES = 'route:middlewares';
export const MIDDLEWARES = 'controller:middlewares';
export const CONTROLLERS = 'app:controllers';
export const INTERCEPTOR = 'app:interceptors';
export const ENDPOINT = 'route:endpoints';
export const OK_METADATA_KEY = 'custom:ok';

export const SERVER_CONFIG_KEY = 'server:config';
export const USE_MIDDLEWARE = 'controller:usemiddleware';

export const WS_HANDLER = 'websocket:handler';
export const WS_TOPIC_KEY = 'websocket:topic';
export const WS_SERVICE_KEY = 'websocket:service';
export const INTERCEPT = 'server:intercept';
export const CATCH = 'server:catch';
export const SANITIZE = 'action:sanitize';

export const STOPPED = `
╔════════════════════════════════════════╗
║  👋 Server stopped                      ║
║  📊 Status: STOPPED                      ║
╚════════════════════════════════════════╝
          `;

export const OK_STATUSES = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
export const TO_VALIDATE = ['headers', 'params', 'multipart', 'query', 'body'];

export const CORS_METADATA = 'cors:config';
export const SSE_METADATA_KEY = 'sse:handlers';
export const SSE_TOPIC_KEY = 'sse:topics';
export const SSE_SERVICE_KEY = 'sse:service';
export const STATIC_METADATA_KEY = 'static:config';

export enum DECORATOR {
  controller = 'controller:config',
  middlewares = 'controller:middlewares',
  route = 'controller:route',
}

export const GRPC_SERVICE_METADATA = Symbol('grpc:service');
export const GRPC_METHOD_METADATA = Symbol('grpc:method');
export const GRPC_CLIENT_METADATA = Symbol('grpc:client');

export const WS_HASH = '50a66195d31a5bb6afd46c844c16e396a6aaeb4c61b3f5e601ab4f487cd3f880';
export const SSE_HASH = 'fe3811fe21af748f53a05a169da84013d11253a53e3ef80355d20419fd89042e' as any;
export const HANDLE_REQUEST_HASH =
  '8ee31d7d0e15b0c9643a42a5af2e7cbe23c33df6dcc0e0652edcfcb15e7064d9';
export const META_HASH = 'ea3bd73e2b506e00527232b3ed743c066da83a8e3066f62a71e75eb9b4aa1db6';
export const PRECOMILED_HASH = 'c199656353369457876c63e8ab6519c707ac261119495e9a333e933f862496ff';
export const LOOKUP_WS_HASH = '4d71be588ec04ca0bbde16e2862b2093d192a29b93a7c9822fec4a0cd5198a23';
export const LOOKUP_SEE_HASH = '5dda315d20887cffe99247ea0a60354847b4e95f77a370ed963807209210bb77';
export const GET_SEE_CONTROLLER_HASH =
  'f1b17e1580cc09c25f691d4dc2db184d7ffc7136f6a7970c2d2cd982384119aa';
export const GET_WS_HANDLERS_HASH =
  'a0169bfef6b51ae7ff3d2edc075a426bca6d18a9efc268b0e16de9cd06ec29cd';
export const GET_SSE_HANDLERS_HASH =
  'ca2e883d5a9437cc0185e6cfa07ca0aa09221e147fc33c8d58953486cd437e36';
export const GET_SSE_CONTROLLER_HASH =
  '7a33b27add95cb1eff1844effa5d04e7eecd61b4765d020b6e998c10443a1a30';
export const GET_WS_TOPICS_HASH =
  'f747f1d2451cc241c1c46d995c9e0b0bb4fe225de49ad20fd38f20033d80ade1';
export const TYPED_HANDLER_HASH =
  '61ef535e8e195aee2e5bc25df1564f762777271244030d76cf2097d9a9950645';

export const CONTROLLER_PROPERTIES_HASH = [
  WS_HASH,
  SSE_HASH,
  HANDLE_REQUEST_HASH,
  META_HASH,
  PRECOMILED_HASH,
  LOOKUP_WS_HASH,
  GET_SEE_CONTROLLER_HASH,
  GET_WS_HANDLERS_HASH,
  GET_SSE_HANDLERS_HASH,
  GET_SSE_CONTROLLER_HASH,
  GET_WS_TOPICS_HASH,
  TYPED_HANDLER_HASH,
];
