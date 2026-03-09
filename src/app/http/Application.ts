import { STOPPED } from '@constants';
import { AppRequest, HTTP_METHODS, ResponseWithStatus, ServerConfig } from '@types';
import { collectRawBody, ParseBody, ParseCookies, ParseQuery, resolveConfig } from '@utils';
import http, { IncomingMessage, ServerResponse } from 'http';
import { Socket } from './Socket';
import { WebSocketService } from './websocket/WebsocetService';
import { WebSocketServer } from './websocket/WebsocketServer';

export class HttpServer extends Socket {
  private app: http.Server;
  private config: ServerConfig;
  private isRunning: boolean = false;

  constructor(configOrClass: new (...args: any[]) => any) {
    super();
    this.config = resolveConfig(configOrClass);

    const app = http.createServer(this.requestHandler.bind(this));

    if (this.config.websocket?.enabled) {
      this.wss = new WebSocketServer(app, {
        path: this.config.websocket.path || '/',
      });
      WebSocketService.getInstance().initialize(this.wss);
    }

    this.app = app;

    // this.logConfig();
  }

  private logConfig() {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Configuration               
╠════════════════════════════════════════╣
║  📍 Host: ${this.config.host}                       
║  🔌 Port: ${this.config.port}                         
║  🔌 Websocket: ${!!this.config.websocket}                         
║  🔧 Middlewares: ${this.config.midlewares?.length || 0}                   
║  🔧 Error middlewares: ${this.config.errorHandler?.length || 0}                   
║  🎯 Interceptors: ${this.config.interceptors?.length || 0}                   
║  📦 Controllers: ${this.config.controllers?.length || 0}                   
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
          console.log(STOPPED);
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

  private async requestHandler(req: IncomingMessage, res: ServerResponse) {
    const startTime = Date.now();

    try {
      const request = await this.createRequest(req);

      let appRequest = await this.applyMiddlewares(request, req, res);
      const data = await this.findController(appRequest, req, res);

      const finalResponse = await this.applyInterceptors(data, req, res);

      await this.sendResponse(res, finalResponse, startTime);
    } catch (error) {
      await this.handleError(error, req, res, startTime);
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

    const whatwgUrl = new URL(fullUrl);

    return {
      method: req.method?.toUpperCase() as HTTP_METHODS,
      url: whatwgUrl,
      headers: req.headers,
      body: parsedBody,
      rawBody: rawBody,
      query: ParseQuery(whatwgUrl),
      params: {},
      cookies: ParseCookies(req),
      isBase64Encoded: false,
      _startTime: Date.now(),
    };
  }

  private async applyMiddlewares(
    appRequest: any,
    request: IncomingMessage,
    response: http.ServerResponse,
  ): Promise<any> {
    let processed = appRequest;

    for (const middleware of this.config.midlewares || []) {
      const result = await middleware(processed, request, response);
      if (result) {
        processed = result;
      }
    }

    return processed;
  }

  private async findController(
    appRequest: AppRequest,
    request: IncomingMessage,
    response?: ServerResponse,
  ): Promise<any> {
    for (const ControllerClass of this.config.controllers || []) {
      const instance = new ControllerClass();
      if (typeof instance.handleRequest === 'function') {
        const data = await instance.handleRequest(appRequest, request, response);

        if (data && data.status !== 404) {
          return data;
        }
      }
    }

    return {
      status: 404,
      data: { message: `Route ${appRequest.method} ${appRequest.url.pathname} not found` },
    };
  }

  private async applyInterceptors(
    data: any,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<any> {
    let processed = data;

    for (const interceptor of this.config.interceptors || []) {
      processed = await interceptor(processed, request, response);
    }

    return processed;
  }

  private async sendResponse(
    res: http.ServerResponse,
    data: any,
    startTime: number,
  ): Promise<void> {
    const response = data?.data !== undefined ? data.data : data;
    if (!res.headersSent) {
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
    }
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    res.statusCode = data.status ?? 200;

    res.end(JSON.stringify(response));
  }

  private async handleError(
    error: any,
    request: http.IncomingMessage,
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
      errorResponse = intercepted;
    } catch (cathed) {
      Object.assign(errorResponse, cathed);
    }
    return this.sendResponse(response, errorResponse, startTime);
  }
}
