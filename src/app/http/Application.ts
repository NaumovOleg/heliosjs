import { CONTROLLERS, OK_STATUSES, STATISTIC } from '@constants';
import {
  AppRequest,
  ControllerType,
  HTTP_METHODS,
  HttpPlugin,
  IHttpServer,
  MiddlewareCB,
  ServerConfig,
} from '@types';
import {
  collectRawBody,
  getErrorType,
  handleCORS,
  NextFN,
  ParseBody,
  ParseCookies,
  ParseQuery,
  resolveConfig,
  sanitizeRequest,
  serializeError,
  staticMiddleware,
} from '@utils';
import { PubSub } from 'graphql-subscriptions';
import { useServer } from 'graphql-ws/use/ws';
import { createYoga } from 'graphql-yoga';
import http, { IncomingMessage, ServerResponse } from 'http';
import { GraphQLModule } from '../../graphql/module';
import { PubSubService } from '../../graphql/pubsubService';
import { SSEServer } from '../../sse/server';
import { SSEService } from '../../sse/service';
import { WebSocketServer } from '../../ws/server';
import { WebSocketService } from '../../ws/service';
import { Plugin } from '../plugin';

export class HttpServer extends Plugin implements IHttpServer {
  private config: ServerConfig;
  private graphqlHandler?: any;
  private isRunning: boolean = false;
  private sse?: SSEServer;
  private websocket?: WebSocketServer;
  private resolverClasses: any[] = [];
  controllers: ControllerType[] = [];
  middlewares: MiddlewareCB[] = [];
  graphql?: GraphQLModule;
  app: http.Server;
  plugins: HttpPlugin[] = [];

  constructor(configOrClass: new (...args: any[]) => any) {
    super();
    this.config = resolveConfig(configOrClass);

    this.resolverClasses = (this.config.resolvers || []).filter(
      (r) => typeof r === 'function' && r.name,
    );

    this.controllers = this.controllers.concat(this.config.controllers ?? []);
    this.middlewares = this.middlewares.concat(this.config.middlewares ?? []);
    this.collectControllers(this.config.controllers);

    const app = http.createServer(this.requestHandler.bind(this));

    for (const st of this.config.statics ?? []) {
      const staticMw = staticMiddleware(st.path, st.options);
      this.middlewares?.unshift(staticMw as MiddlewareCB);
    }

    if (this.config.websocket?.enabled || this.config.graphql?.websocket) {
      this.websocket = new WebSocketServer(app, { path: this.config.websocket?.path ?? '/ws' });
      this.websocket.registerControllers(this.controllers);
      WebSocketService.getInstance().initialize(this.websocket!);
    }

    if (this.config.graphql?.enabled) {
      this.setupGraphQL();
    }

    if (this.config.sse?.enabled) {
      this.sse = new SSEServer();
      this.sse.registerControllers(this.controllers);
      SSEService.getInstance().initialize(this.sse);
    }

    this.app = app;
    this.logConfig();
  }

  private collectControllers(controllers: ControllerType[] = []) {
    for (const ControllerClass of controllers || []) {
      if (typeof ControllerClass !== 'function') {
        continue;
      }

      this.controllers.push(ControllerClass);
      const subControllers = Reflect.getMetadata(CONTROLLERS, ControllerClass.prototype) || [];
      if (subControllers.length > 0) {
        this.collectControllers(subControllers);
      }
    }
  }

  private logConfig() {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Configuration               
╠════════════════════════════════════════╣
║  📍 Host: ${this.config.host}                       
║  🔌 Port: ${this.config.port}                         
║  🔌 Websocket: ${!!this.config.websocket}                         
║  🔧 Global Middlewares: ${this.middlewares?.length || 0}                   
║  🔧 Error handler: ${!this.config.errorHandler}                   
║  🎯 Global Interceptors: ${!!this.config.interceptor?.length}                   
║  📦 Controllers: ${STATISTIC.controllers}                   
║  📦 Routes: ${this.controllers.length}                   
║  📦 GraphQL resolvers: ${this.resolverClasses.length}                   
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

  public status(): { running: boolean; config: ServerConfig } {
    return {
      running: this.isRunning,
      config: this.config,
    };
  }

  private async requestHandler(req: IncomingMessage, response: ServerResponse) {
    const startTime = Date.now();

    let request: AppRequest;

    try {
      await this.callPluginHook('beforeRequest', req);
    } catch (data: any) {
      return this.sendResponse(response, { status: 500, data }, startTime);
    }

    try {
      request = await this.createRequest(req);
    } catch (err: any) {
      return this.sendResponse(response, { status: 500, data: err.message }, startTime);
    }

    try {
      let handledCors = { permitted: true, continue: true };
      if (this.config.cors) {
        handledCors = handleCORS(request, response, this.config.cors);
      }

      if (!handledCors.permitted) {
        return this.sendResponse(
          response,
          { status: 403, message: 'CORS: Origin not allowed' },
          startTime,
          request,
        );
      }
      if (!handledCors.continue && handledCors.permitted) {
        return this.sendResponse(response, { status: 204 }, startTime, request);
      }

      await this.beforeRequest(request, response);

      if (response.headersSent) {
        return;
      }
      await this.callPluginHook('beforeRoute', request, response);
      let controllerResponse = await this.runController(request, response);

      if (!controllerResponse.routeMatch) {
        return this.sendResponse(
          response,
          { status: 404, data: 'Route not found' },
          Date.now(),
          request,
        );
      }

      const isError =
        getErrorType(controllerResponse.data).isError || !OK_STATUSES.includes(response.statusCode);
      if (isError) {
        return this.handleError(controllerResponse.data, request, response, startTime);
      }

      if (this.config.interceptor && controllerResponse) {
        controllerResponse.data = await this.config.interceptor(
          controllerResponse,
          request,
          response,
        );
      }

      return this.sendResponse(
        response,
        { status: response.statusCode ?? 200, data: controllerResponse.data },
        startTime,
        request,
      );
    } catch (error: any) {
      return this.handleError(error, request, response, startTime);
    }
  }

  private async createRequest(req: http.IncomingMessage): Promise<AppRequest> {
    const rawBody = await collectRawBody(req);

    const parseRequest = {
      body: rawBody,
      headers: req.headers,
      isBase64Encoded: false,
    };

    const parsedBody = ParseBody(parseRequest);

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost';
    const fullUrl = `${protocol}://${host}${req.url}`;

    const requestUrl = new URL(fullUrl);

    const parsedRequest = {
      method: req.method?.toUpperCase() as HTTP_METHODS,
      requestUrl,
      headers: req.headers,
      body: parsedBody,
      rawBody: rawBody,
      query: ParseQuery(requestUrl),
      params: {},
      cookies: ParseCookies(req),
      isBase64Encoded: false,
      _startTime: Date.now(),
    };

    Object.assign(req, parsedRequest);
    return req as AppRequest;
  }

  private async beforeRequest(request: AppRequest, response: http.ServerResponse): Promise<any> {
    sanitizeRequest(request, this.config.sanitizers ?? []);

    for (const middleware of this.middlewares?.reverse() || []) {
      await middleware(request, response, NextFN);
    }
  }

  private async runController(request: AppRequest, response?: ServerResponse): Promise<any> {
    for (const ControllerClass of this.controllers ?? []) {
      const instance = new ControllerClass();
      if (typeof instance.handleRequest === 'function') {
        const handlerResponse = await instance.handleRequest(request, response);
        if (handlerResponse.routeMatch) {
          return handlerResponse;
        }
      }
    }
    return {};
  }

  private async sendResponse(
    res: http.ServerResponse,
    responseData: any,
    startTime: number,
    appRequest?: AppRequest,
  ): Promise<void> {
    if (res.headersSent) return;

    const { status, data } = responseData;

    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }

    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    res.statusCode = status ?? data.status ?? 200;

    res.end(JSON.stringify(data));
    await this.callPluginHook('afterResponse', appRequest, res);
  }

  private async handleError(
    error: any,
    request: AppRequest,
    response: http.ServerResponse,
    startTime: number,
  ): Promise<void> {
    let serialized = serializeError(error);

    if (!this.config.errorHandler) {
      return this.sendResponse(response, { data: serialized }, startTime);
    }

    try {
      const intercepted = await this.config.errorHandler(error, request, response);

      let data = intercepted.data ?? intercepted;
      if (data instanceof Error) {
        data = serializeError(data);
      }
      serialized = data ?? serialized;
    } catch (cathed) {}

    return this.sendResponse(response, { data: serialized }, startTime, request);
  }

  private setupGraphQL() {
    if (!this.config.graphql?.enabled) return;

    if (this.resolverClasses.length === 0) {
      return;
    }
    const pubsub = PubSubService.getInstance();
    const graphqlModule = new GraphQLModule(this.resolverClasses);
    const schema = graphqlModule.getSchema();

    console.log('📦 PubSub instance created:', {
      isPubSub: pubsub instanceof PubSub,
      hasPublish: typeof pubsub.publish === 'function',
      hasAsyncIterator: typeof pubsub.asyncIterator === 'function',
    });

    const yoga = createYoga({
      schema,
      context: (ctx) => {
        const req = ctx.request || (ctx as any).req;
        return { req, headers: req?.headers, pubsub };
      },
      graphiql: !!this.config.graphql?.playground,
    });

    this.graphqlHandler = yoga;
    if (this.websocket) {
      useServer({ schema, context: () => ({ pubsub }) }, this.websocket.wss);
    }

    this.use(async (req, res) => {
      const path = this.config.graphql?.path ?? '/graphql';
      if (req.requestUrl.pathname?.startsWith(path)) {
        await this.graphqlHandler(req, res);
      }
    });
  }

  public use(middleware: MiddlewareCB): this {
    this.middlewares.unshift(middleware);
    return this;
  }
}
