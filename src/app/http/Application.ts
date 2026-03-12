import { CONTROLLERS, OK_STATUSES, STATISTIC } from '@constants';
import { AppRequest, ControllerType, HTTP_METHODS, ResponseWithStatus, ServerConfig } from '@types';
import {
  collectRawBody,
  handleCORS,
  NextFN,
  ParseBody,
  ParseCookies,
  ParseQuery,
  resolveConfig,
  sanitizeRequest,
} from '@utils';
import http, { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from '../../ws/server';
import { WebSocketService } from '../../ws/service';

import { SSEServer } from '../../sse/server';
import { SSEService } from '../../sse/service';

export class HttpServer {
  private app: http.Server;
  private config: ServerConfig;
  private isRunning: boolean = false;
  private sse?: SSEServer;
  private websocket?: WebSocketServer;

  constructor(configOrClass: new (...args: any[]) => any) {
    this.config = resolveConfig(configOrClass);

    const app = http.createServer(this.requestHandler.bind(this));
    const controllers = this.getAllControllers(this.config.controllers);
    if (this.config.websocket?.enabled) {
      this.websocket = new WebSocketServer(app, { path: this.config.websocket.path });
      this.websocket.registerControllers(controllers);
      WebSocketService.getInstance().initialize(this.websocket!);
    }

    if (this.config.sse?.enabled) {
      this.sse = new SSEServer();
      this.sse.registerControllers(controllers);
      SSEService.getInstance().initialize(this.sse);
    }

    this.app = app;

    this.logConfig();
  }

  private logConfig() {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Configuration               
╠════════════════════════════════════════╣
║  📍 Host: ${this.config.host}                       
║  🔌 Port: ${this.config.port}                         
║  🔌 Websocket: ${!!this.config.websocket}                         
║  🔧 Global Middlewares: ${this.config.middlewares?.length || 0}                   
║  🔧 Error handler: ${!this.config.errorHandler}                   
║  🎯 Global Interceptors: ${!!this.config.interceptor?.length}                   
║  📦 Controllers: ${STATISTIC.controllers}                   
║  📦 Routes: ${STATISTIC.routes}                   
╚════════════════════════════════════════╝
    `);
  }

  public async listen(port?: number, host?: string): Promise<http.Server> {
    if (this.isRunning) {
      console.log('⚠️ Server is already running');
      return this.app;
    }

    const listenPort = port || this.config.port || 3000;
    const listenHost = host || this.config.host || 'localhost';

    return new Promise((resolve, reject) => {
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

        this.app.on('error', (error) => {
          console.error('❌ Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private getAllControllers(controllers: ControllerType[] = []): ControllerType[] {
    const result = [];
    for (const ControllerClass of controllers || []) {
      const instance = new ControllerClass();
      result.push(instance);

      const subControllers = Reflect.getMetadata(CONTROLLERS, ControllerClass.prototype) || [];

      result.push(...this.getAllControllers(subControllers));
    }

    return result;
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      this.app.close((err) => {
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
      request = await this.createRequest(req);
    } catch (err: any) {
      return this.sendResponse(response, { status: 500, message: err.message }, startTime);
    }

    try {
      let handledCors = { permitted: true, continue: true };
      if (this.config.cors) {
        handledCors = handleCORS(request!, response, this.config.cors);
      }

      if (!handledCors.permitted) {
        return this.sendResponse(
          response,
          { status: 403, message: 'CORS: Origin not allowed' },
          startTime,
        );
      }
      if (!handledCors.continue && handledCors.permitted) {
        return this.sendResponse(response, { status: 204 }, startTime);
      }

      await this.beforeRequest(request, response);
      let data = await this.findController(request, response);

      const isError = !OK_STATUSES.includes(data.status);
      if (isError) {
        return this.handleError(data, request, response, startTime);
      }
      if (this.config.interceptor) {
        data = await this.config.interceptor(data, request, response);
      }

      return this.sendResponse(response, data, startTime);
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

    for (const middleware of this.config.middlewares?.reverse() || []) {
      await middleware(request, response, NextFN);
    }
  }

  private async findController(request: AppRequest, response?: ServerResponse): Promise<any> {
    for (const ControllerClass of this.config.controllers || []) {
      const instance = new ControllerClass();
      if (typeof instance.handleRequest === 'function') {
        const data = await instance.handleRequest(request, response);
        if (data && data.status !== 404) {
          return data;
        }
      }
    }

    return {
      status: 404,
      data: { message: `Route ${request.method} ${request.requestUrl.pathname} not found` },
    };
  }

  private async sendResponse(
    res: http.ServerResponse,
    data: any,
    startTime: number,
  ): Promise<void> {
    const response = data?.data !== undefined ? data.data : data;
    if (res.headersSent) return;

    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }

    if (data?.headers) {
      Object.entries(data.headers).forEach(([key, value]) => {
        if (!res.getHeader(key)) {
          res.setHeader(key, value as string);
        }
      });
    }

    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    res.statusCode = data.status ?? 200;

    res.end(JSON.stringify(response));
  }

  private async handleError(
    error: any,
    request: AppRequest,
    response: http.ServerResponse,
    startTime: number,
  ): Promise<void> {
    let errorResponse: ResponseWithStatus = {
      status: error.status || 500,
      data: {
        message: error.message || 'Internal Server Error',
        errors: error.errors || [],
      },
    };

    if (!this.config.errorHandler) {
      return this.sendResponse(response, errorResponse, startTime);
    }

    try {
      const intercepted = await this.config.errorHandler(error, request, response);

      if (typeof intercepted === 'object') {
        errorResponse.status = intercepted.status ?? errorResponse.status;
        errorResponse.data = intercepted.message ?? intercepted.data ?? intercepted;
      } else {
        errorResponse.data = intercepted;
      }
    } catch (cathed) {
      Object.assign(errorResponse, cathed);
    }

    return this.sendResponse(response, errorResponse, startTime);
  }
}
