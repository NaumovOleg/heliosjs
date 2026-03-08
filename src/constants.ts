export const PARAM_METADATA_KEY = 'design:parameters';
export const APP_METADATA_KEY = 'app:configuration';
export const ROUTE_PREFIX = 'route:profix';
export const MIDDLEWARES = 'route:middlewares';
export const CONTROLLERS = 'app:controllers';
export const INTERCEPTORS = 'app:interceptors';
export const ENDPOINT = 'route:endpoints';
export const OK_METADATA_KEY = 'custom:ok';

export const SERVER_CONFIG_KEY = 'server:config';
export const SERVER_MODULES_KEY = 'server:modules';

export const WS_METADATA_KEY = 'websocket:handler';
export const WS_TOPIC_KEY = 'websocket:topic';
export const WS_SERVICE_KEY = 'websocket:service';

export const STOPPED = `
╔════════════════════════════════════════╗
║  👋 Server stopped                      ║
║  📊 Status: STOPPED                      ║
╚════════════════════════════════════════╝
          `;

export const OK_STATUSES = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
export const TO_VALIDATE = ['headers', 'params', 'multipart', 'query', 'body'];
