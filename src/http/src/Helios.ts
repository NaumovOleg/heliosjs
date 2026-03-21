import { useServer } from 'graphql-ws/use/ws';
import { createPubSub, createYoga } from 'graphql-yoga';
import http, { IncomingMessage, ServerResponse } from 'http';
import { buildSchema, NonEmptyArray } from 'type-graphql';
import { CONTROLLERS } from './constants';
import { ControllerType, MiddlewareCB, Request, Response } from './types/core';
import { Plugin as HttpPlugin, IHttpServer, ServerConfig } from './types/http';
import { handleCORS, NextFunction, sanitizeRequest } from './utils/core';
import {
  Plugin,
  RequestFactory,
  resolveConfig,
  ResponseFactory,
  staticMiddleware,
} from './utils/http';
import { WebSocketServer, WebSocketService } from './utils/socket';
import { SSEServer, SSEService } from './utils/sse';

export class Helios extends Plugin implements IHttpServer {
  private config: ServerConfig;
  private isRunning: boolean = false;
  private sse?: SSEServer;
  private websocket?: WebSocketServer;
  controllers: ControllerType[] = [];
  middlewares: MiddlewareCB[] = [];
  app: http.Server;
  plugins: HttpPlugin[] = [];
  allContriollers: ControllerType[] = [];
  staticMiddlewares: any = [];

  constructor(configOrClass: new (...args: any[]) => any) {
    super();
    this.config = resolveConfig(configOrClass);

    this.middlewares = this.middlewares.concat(this.config.middlewares ?? []);
    this.controllers = this.collectControllers(this.config.controllers ?? []);

    this.app = http.createServer(this.requestHandler.bind(this));

    for (const st of this.config.statics ?? []) {
      const staticMw = staticMiddleware(st.path, st.options);
      this.staticMiddlewares.push(staticMw);
    }

    if (this.config.websocket && this.config.graphql) {
      throw new Error(`You  cant't use custom websocket with graphql`);
    }
    if (this.config.websocket) {
      this.setUpWebsocket();
    }

    if (this.config.graphql) {
      this.setupGraphQL();
    }

    if (this.config.sse?.enabled) {
      this.sse = new SSEServer();
      this.sse.registerControllers(this.controllers);
      SSEService.getInstance().initialize(this.sse);
    }

    this.logConfig();
  }

  setUpWebsocket() {
    this.websocket = new WebSocketServer(this.app, { path: this.config.websocket?.path ?? '/ws' });
    this.websocket.registerControllers(this.controllers);
    WebSocketService.getInstance().initialize(this.websocket!);
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

  private logConfig() {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Configuration               
╠════════════════════════════════════════╣
║  📍 Host: ${this.config.host}                       
║  🔌 Port: ${this.config.port}                         
║  🔌 Websocket: ${!!this.config.websocket && this.config.graphql?.pubSub}                         
║  🔌 Websocket path prefix: ${this.config.websocket?.path ?? '/ws'}                       
║  🔧 Global Middlewares: ${this.middlewares?.length || 0}                   
║  🔧 Error handler: ${!this.config.errorHandler}                   
║  🎯 Global Interceptors: ${!!this.config.interceptor?.length}                   
║  📦 Root controllers: ${this.config.controllers?.length ?? 0}                   
║  📦 Sub controllers: ${this.controllers.length - (this.config.controllers?.length ?? 0)}                                    
║  📦 GraphQL resolvers: ${this.config.graphql?.resolvers?.length ?? 0}                   
╚════════════════════════════════════════╝
    `);
  }

  public async listen(port?: number, host?: string): Promise<http.Server> {
    if (this.isRunning) {
      return this.app;
    }

    const listenPort = port || this.config.port || 3000;
    const listenHost = host || this.config.host || 'localhost';

    return new Promise(async (resolve, reject) => {
      try {
        this.app.listen(listenPort, listenHost, () => {
          this.isRunning = true;
          console.log(`
╔════════════════════════════════════════╗
║  🎉 Server started successfully!       
║  📍 http://${listenHost}:${listenPort}  
║  📊 Status: RUNNING                    
╚════════════════════════════════════════╝
          `);

          resolve(this.app);
        });

        await this.callPluginMethod('onStart', this.app);

        this.app.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      this.app.close(async (err) => {
        await this.callPluginMethod('onStop', this.app);
        if (err) {
          reject(err);
        } else {
          this.isRunning = false;
          resolve();
        }
      });
    });
  }

  public status() {
    return { running: this.isRunning, config: this.config };
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse) {
    const startTime = Date.now();

    const request = await RequestFactory.create(req);
    const response = ResponseFactory.create(res, request);

    try {
      await this.callPluginHook('beforeRequest', req);
    } catch (error: any) {
      response.status = 500;
      response.data = error;
      return this.sendResponse(request, response, startTime);
    }
    if (response.headersSent) return;

    try {
      let handledCors = this.config.cors
        ? handleCORS(request, response, this.config.cors)
        : { permitted: true, continue: true };

      if (!handledCors.permitted) {
        response.status = 403;
        response.data = 'CORS: Origin not allowed';
        return this.sendResponse(request, response, startTime);
      }
      if (!handledCors.continue && handledCors.permitted) {
        response.status = 204;
        return this.sendResponse(request, response, startTime);
      }

      await this.beforeRequest(request, response);

      if (response.headersSent) return;
      await this.callPluginHook('beforeRoute', request, response);
      if (response.headersSent) return;

      await this.runController(request, response);

      return this.sendResponse(request, response, startTime);
    } catch (error: any) {
      response.error(error);
      return this.sendResponse(request, response, startTime);
    }
  }

  private async beforeRequest(request: Request, response: Response): Promise<any> {
    sanitizeRequest(request, this.config.sanitizers ?? []);

    for (const middleware of this.staticMiddlewares) {
      await middleware(request.raw, response.raw, NextFunction);
    }
    if (response.raw.headersSent) {
      return;
    }
    for (const middleware of this.middlewares?.reverse() || []) {
      await middleware(request, response, NextFunction);
    }
  }

  private async runController(request: Request, response: Response): Promise<any> {
    for (const ControllerClass of this.controllers ?? []) {
      const instance = new ControllerClass();
      if (typeof instance.handleRequest === 'function') {
        const done = await instance.handleRequest(request, response);
        if (done) {
          break;
        }
      }
    }
  }

  private async sendResponse(
    request: Request,
    response: Response,
    startTime: number,
  ): Promise<void> {
    if (response.headersSent) return;

    if (!response.getHeader('Content-Type')) {
      response.setHeader('Content-Type', 'application/json');
    }

    response.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);

    try {
      response.end(response.data);
      await this.callPluginHook('afterResponse', request, response);
    } catch (err) {
      response.status = 500;
      response.error(err);
      response.end(err);
    }
  }

  private async setupGraphQL() {
    if (!this.config.graphql || !this.config.graphql?.resolvers?.length) return;

    const graphqlWsServer = new WebSocketServer(this.app, {
      path: this.config.graphql.path ?? '/graphql',
    });

    const schemaConfig = {
      resolvers: this.config.graphql?.resolvers as NonEmptyArray<Function>,
      validate: true,
    };

    if (this.config.graphql.pubSub) {
      Object.assign(schemaConfig, { pubSub: this.config.graphql.pubSub });
    }

    const schema = await buildSchema(schemaConfig);

    const yoga = createYoga({
      schema,
      context: (ctx: any) => {
        const req = ctx.request ?? (ctx as any).req;

        return {
          request: req.raw,
          headers: req?.headers,
          pubSub: this.config.graphql?.pubSub ?? createPubSub(),
        };
      },
      graphiql: !!this.config.graphql?.playground,
    });

    if (this.config.graphql.pubSub) {
      useServer(
        { schema, context: () => ({ pubSub: this.config.graphql?.pubSub }) },
        graphqlWsServer.wss,
      );
      this.use(async (req, res) => {
        if (req.requestUrl.pathname?.startsWith('/graphql')) {
          await yoga(req.raw as any, res.raw);
        }
      });
    }
  }

  public use(middleware: MiddlewareCB): this {
    this.middlewares.unshift(middleware);
    return this;
  }
}
