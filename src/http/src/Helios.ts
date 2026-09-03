import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import { CONTROLLER_REQUEST, CONTROLLERS } from '@heliosjs/core/constants';
import type {
  ControllerClass,
  ControllerMeta,
  ControllerType,
  IController,
  MiddlewareCB,
  MiddlewaresMetadataItem,
  NonEmptyArray,
  Request,
  Response,
} from '@heliosjs/core/types';
import {
  handleCORS,
  SSEServer,
  SSEService,
  sanitizeRequest,
  setFingerprintConfig,
  setRolesExtractor,
  WebSocketServer,
  WebSocketService,
} from '@heliosjs/core/utils';
import type { Plugin as HttpPlugin, IHttpServer, ServerConfig } from './types/http';
import {
  Plugin,
  RequestFactory,
  ResponseFactory,
  resolveConfig,
  staticMiddleware,
} from './utils/http';

/**
 * HTTP runtime entrypoint for Helios applications.
 *
 * It compiles decorated controllers, wires middleware/plugins, and exposes
 * lifecycle methods to start/stop the underlying Node.js HTTP server.
 *
 * @example
 * ```ts
 * const app = new Helios(AppModule);
 * await app.listen(3000, '0.0.0.0');
 * ```
 */
export class Helios extends Plugin implements IHttpServer {
  private readonly config: ServerConfig;
  private isRunning = false;
  private listenPromise?: Promise<http.Server>;
  private readonly sse?: SSEServer;
  private websocket?: WebSocketServer;
  controllers: ControllerType[] = [];
  middlewares: MiddlewareCB[] = [];
  globalMiddlewares: MiddlewareCB[] = [];
  app: http.Server;
  plugins: HttpPlugin[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  staticMiddlewares: ((...args: any[]) => any)[] = [];
  rootControllers: ControllerType[] = [];

  /**
   * Creates a new Helios HTTP application.
   *
   * @param configOrClass - Root module/class that contains server decorators
   * and controller configuration.
   */
  constructor(configOrClass: new (...args: unknown[]) => unknown) {
    super();
    this.config = resolveConfig(configOrClass);
    if (this.config.rbac?.getRoles) {
      setRolesExtractor(this.config.rbac.getRoles);
    }
    if (this.config.fingerprint) {
      setFingerprintConfig(this.config.fingerprint);
    }

    this.middlewares = this.middlewares.concat(this.config.middlewares ?? []);
    this.rootControllers = this.compileControllers(this.config.controllers ?? []);
    this.controllers = this.collectControllers(this.config.controllers ?? []);

    this.app = http.createServer(this.requestHandler.bind(this));

    if (this.config.requestTimeout !== undefined) {
      this.app.requestTimeout = this.config.requestTimeout;
    }
    if (this.config.headersTimeout !== undefined) {
      this.app.headersTimeout = this.config.headersTimeout;
    }

    for (const st of this.config.statics ?? []) {
      const staticMw = staticMiddleware(st.root ?? st.path, { ...st.options, path: st.root ? st.path : undefined } as any);
      this.staticMiddlewares.push(staticMw);
    }

    if (this.config.websocket && this.config.graphql) {
      throw new Error(`You  can't use custom websocket with graphql`);
    }
    if (this.config.websocket) {
      this.setUpWebsocket();
    }

    if (this.config.sse?.enabled) {
      this.sse = new SSEServer();
      if (this.config.cors) {
        this.sse.setCorsConfig(this.config.cors);
      }
      this.sse.registerControllers(this.controllers);
      SSEService.getInstance().initialize(this.sse);
    }

    this.logConfig();
  }

  /**
   * Initializes the built-in WebSocket server using current HTTP server and config.
   *
   * This method is called automatically when `websocket` config is enabled.
   */
  setUpWebsocket() {
    this.websocket = new WebSocketServer(this.app, {
      path: this.config.websocket?.path ?? '/ws',
    });
    this.websocket.registerControllers(this.config.websocket?.controllers ?? []);
    WebSocketService.getInstance().initialize(this.websocket);
  }

  private logConfig() {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Configuration               
╠════════════════════════════════════════╣
║  📍 Host: ${this.config.host}                       
║  🔌 Port: ${this.config.port}                         
║  🔌 Websocket: ${!!this.config.websocket}                         
║  🔌 Websocket path prefix: ${this.config.websocket?.path ?? '/ws'}                       
║  🔧 Global Middlewares: ${this.middlewares?.length || 0}                   
║  🔧 Error handler: ${!this.config.errorHandler}                   
║  🎯 Global Interceptors: ${!!this.config.interceptors?.length}                   
║  📦 Controllers: ${this.controllers?.length ?? 0}                   
║  📦 Sub controllers: ${
      this.controllers.length - (this.config.controllers?.length ?? 0)
    }                                    
║  📦 GraphQL resolvers: ${this.config.graphql?.resolvers?.length ?? 0}                   
╚════════════════════════════════════════╝
    `);
  }

  /**
   * Starts the HTTP server.
   *
   * If no arguments are provided, values are resolved from server config and
   * then fallback to `3000` and `localhost`.
   *
   * @param port - Optional TCP port.
   * @param host - Optional hostname or IP to bind.
   * @returns Promise resolving with the underlying Node.js server instance.
   *
   * @example
   * ```ts
   * await app.listen();
   * await app.listen(8080, '127.0.0.1');
   * ```
   */
  public async listen(port?: number, host?: string) {
    if (this.isRunning) {
      return this.app;
    }

    const listenPort = port || this.config.port || 3000;
    const listenHost = host || this.config.host || 'localhost';

    if (this.config.graphql) {
      await this.setupGraphQL();
    }

    this.isRunning = true;
    this.listenPromise = new Promise<http.Server>((resolve, reject) => {
      const server = this.app.listen(listenPort, listenHost, async () => {
        console.log(`
╔════════════════════════════════════════╗
║  🎉 Server started successfully!       
║  📍 http://${listenHost}:${listenPort}  
║  📊 Status: RUNNING                    
╚════════════════════════════════════════╝
          `);

        await this.callPluginMethod('onStart', this.app);
        resolve(server);
      });
      server.on('error', reject);
    });
    return this.listenPromise;
  }

  /**
   * Gracefully stops the HTTP server.
   *
   * Executes plugin `onStop` hooks and resolves when all open connections are
   * closed. If the server is already stopped, it resolves immediately.
   *
   * @returns Promise that resolves once shutdown is complete.
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      const doClose = () => {
        this.app.close(async (err) => {
          if (err) {
            reject(err);
            return;
          }
          await this.callPluginMethod('onStop', this.app);
          this.isRunning = false;
          resolve();
        });
      };

      if (this.listenPromise) {
        this.listenPromise.then(doClose).catch(() => doClose());
      } else {
        doClose();
      }
    });
  }

  /**
   * Returns runtime status and effective server configuration.
   *
   * @returns Current running flag and resolved server config.
   */
  public status() {
    return { running: this.isRunning, config: this.config };
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse) {
    const startTime = Date.now();

    const request = await RequestFactory.create(req, this.config.bodyLimit);
    const response = ResponseFactory.create(res, request);

    try {
      await this.callPluginHook('beforeRequest', req);
    } catch (error: unknown) {
      response.status = 500;
      response.data = error;
      return this.sendResponse(request, response, startTime);
    }
    if (response.headersSent) return;

    try {
      const handledCors = this.config.cors
        ? handleCORS(request, response, this.config.cors)
        : { permitted: true, continue: true };

      if (!handledCors.permitted) {
        response.status = 403;
        response.data = 'CORS: Origin not allowed';
        return this.sendResponse(request, response, startTime);
      }
      if (!handledCors.continue && handledCors.permitted) {
        return this.sendResponse(request, response, startTime);
      }

      await this.beforeRequest(request, response, async () => {
        if (response.headersSent) return;
        await this.callPluginHook('beforeRoute', request, response);
        if (response.headersSent) return;
        await this.runController(request, response);
      });

      return this.sendResponse(request, response, startTime);
    } catch (error: unknown) {
      response.error(error);
      return this.sendResponse(request, response, startTime);
    }
  }

  private async beforeRequest(request: Request, response: Response, restOfPipeline?: () => Promise<void>) {
    for (const sanitizer of this.config.sanitizers ?? []) {
      sanitizeRequest(request, sanitizer);
    }

    const runMiddlewares = async (
      middlewares: ((...args: any[]) => any)[],
      index: number,
      rest: () => Promise<void>
    ): Promise<void> => {
      if (index >= middlewares.length) {
        return rest();
      }
      const middleware = middlewares[index];
      const nextFn = async (error?: Error) => {
        if (error) throw error;
        return runMiddlewares(middlewares, index + 1, rest);
      };
      await middleware(request, response, nextFn);
    };

    const afterStatic: () => Promise<void> = async () => {
      const afterConfig: () => Promise<void> = async () => {
        await runMiddlewares(this.globalMiddlewares, 0, async () => {
          if (restOfPipeline) {
            await restOfPipeline();
          }
        });
      };
      await runMiddlewares(this.middlewares, 0, afterConfig);
    };

    await runMiddlewares(this.staticMiddlewares, 0, async () => {
      if (response.raw.headersSent) {
        return;
      }
      await afterStatic();
    });
  }
  private collectControllers(controllers: ControllerType[] = []): ControllerType[] {
    const result: ControllerType[] = [];
    for (const ControllerClass of controllers) {
      if (typeof ControllerClass !== 'function') {
        continue;
      }
      if (!result.includes(ControllerClass)) {
        result.push(ControllerClass);
      }
      const subControllers = Reflect.getMetadata(CONTROLLERS, ControllerClass.prototype) || [];

      if (subControllers.length > 0) {
        const nestedControllers = this.collectControllers(subControllers);
        for (const nested of nestedControllers) {
          if (!result.includes(nested)) {
            result.push(nested);
          }
        }
      }
    }

    return result;
  }
  private async runController(request: Request, response: Response) {
    for (const instance of this.rootControllers ?? []) {
      const controller = instance as unknown as IController;
      if (typeof controller[CONTROLLER_REQUEST] === 'function') {
        const done = await controller[CONTROLLER_REQUEST](request, response);
        if (done) {
          break;
        }
      }
    }
  }
  private compileControllers(appControllers: ControllerClass[]) {
    const prefix = '/';

    const functions: MiddlewaresMetadataItem[] = this.middlewares.map((middleware) => ({
      middleware,
    }));

    if (this.config.errorHandler) {
      functions.unshift({ errorHandler: this.config.errorHandler });
    }

    const meta: ControllerMeta = {
      prefix,
      routes: [],
      name: 'server-entry',
      controllers: [],
      functions: functions.filter(Boolean),
    };

    const controllers: ControllerType[] = [];

    for (const ControllerClass of appControllers ?? []) {
      controllers.push(new ControllerClass(meta));
    }

    return controllers;
  }

  private async sendResponse(
    request: Request,
    response: Response,
    startTime: number
  ): Promise<void> {
    if (response.headersSent) return;

    if (!response.getHeader('Content-Type') || response.getHeader('Content-Type') === 'application/json') {
      const data = response.data;
      if (typeof data === 'string') {
        response.setHeader('Content-Type', 'text/plain');
      } else {
        response.setHeader('Content-Type', 'application/json');
      }
    }

    response.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);

    try {
      response.end(response.data);
    } catch {
      if (!response.headersSent) {
        response.status = 500;
      }
      return;
    }
    try {
      await this.callPluginHook('afterResponse', request, response);
    } catch {
      // plugin hook error — response already sent, nothing to do
    }
  }

  private async setupGraphQL() {
    if (!this.config.graphql?.resolvers?.length) return;
    const [{ createYoga, createPubSub }, { buildSchema }, { useServer }] = await Promise.all([
      import('graphql-yoga'),
      import('type-graphql'),
      import('graphql-ws/use/ws'),
    ]);

    const graphqlWsServer = new WebSocketServer(this.app, {
      path: this.config.graphql.path ?? '/graphql',
    });

    const schemaConfig = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      resolvers: this.config.graphql?.resolvers as NonEmptyArray<Function>,
      validate: true,
    };

    if (this.config.graphql.pubSub) {
      Object.assign(schemaConfig, { pubSub: this.config.graphql.pubSub });
    }

    const schema = await buildSchema(schemaConfig);

    const yoga = createYoga({
      schema,
      context: (ctx) => {
        return {
          request: ctx.request,
          headers: ctx.request?.headers,
          pubSub: this.config.graphql?.pubSub ?? createPubSub(),
        };
      },
      graphiql: !!this.config.graphql?.playground,
    });

    if (this.config.graphql.pubSub) {
      useServer(
        { schema, context: () => ({ pubSub: this.config.graphql?.pubSub }) },
        graphqlWsServer.wss
      );
      this.use(async (req, res) => {
        if (req.requestUrl.pathname?.startsWith(this.config.graphql?.path ?? '/graphql')) {
          yoga(req.raw, res.raw);
        }
      });
    }
  }

  /**
   * Registers a global middleware at runtime.
   *
   * Middleware added via this method runs before route dispatch for every request.
   *
   * @param middleware - Middleware callback to prepend to global middleware chain.
   * @returns Current Helios instance for chaining.
   *
   * @example
   * ```ts
   * app.use(async (req, res, next) => {
   *   req.headers['x-request-source'] = 'runtime';
   *   await next();
   * });
   * ```
   */
  public use(middleware: MiddlewareCB): this {
    this.globalMiddlewares.push(middleware);
    return this;
  }
}
