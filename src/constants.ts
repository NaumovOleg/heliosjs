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
export const INTECEPT = 'server:intercept';
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

export const STATISTIC: Record<'controllers' | 'routes', number> = {
  controllers: 0,
  routes: 0,
};

export const INCREMENT_STATISTIC = (prop: 'controllers' | 'routes') => {
  STATISTIC[prop] = STATISTIC[prop] + 1;
};

export const CORS_METADATA = 'cors:config';
export const SSE_METADATA_KEY = 'sse:handlers';
export const SSE_TOPIC_KEY = 'sse:topics';
export const SSE_SERVICE_KEY = 'sse:service';
export const STATIC_METADATA_KEY = 'static:config';
export const GRAPHQL_QUERY = 'graphql:query';
export const GRAPHQL_MUTATION = 'graphql:mutation';
export const GRAPHQL_SUBSCRIPTION = 'graphql:subscription';
export const GRAPHQL_TYPE = 'graphql:type';
export const GRAPHQL_INPUT_TYPE = 'graphql:inputType';
export const GRAPHQL_FIELD = 'graphql:field';
export const GRAPHQL_ARG = 'graphql:arg';
export const GRAPHQL_FIELD_RESOLVER = 'graphql:fieldresolver';
export const GRAPHQL_RESOLVER = 'graphql:resolver';
export const GRAPHQL_PUBSUB = 'graphql:pubSub';
export const GRAPHQL_INJECT_PUBSUB = 'graphql:injectpubsub';
export const GRAPHQL_PARAMETER = 'graphql:parameter';
