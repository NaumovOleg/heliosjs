import type {
  ControllerClass,
  ControllerMeta,
  ControllerType,
  CORSConfig,
  IController,
  ErrorObject,
  Request,
  Response,
} from '@heliosjs/core/types';
import { CONTROLLER_REQUEST } from '@heliosjs/core/constants';
import { ApplicationError, getErrorType, handleCORS, setFingerprintConfig, setRolesExtractor } from '@heliosjs/core/utils';
import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { AzureOptions, IAzureAdapter } from './types/azure';
import { Plugin, RequestFactory, ResponseFactory } from './utils/azure';

/**
 * Azure Functions adapter for Helios controllers.
 *
 * Wraps a Helios controller and exposes an Azure Functions v4 `HttpHandler`
 * to register with `app.http`.
 *
 * @example
 * const helios = new Helios(AppController);
 * app.http('api', { methods: ['GET', 'POST'], route: '{*path}', authLevel: 'anonymous', handler: helios.handler });
 */
export class Helios extends Plugin implements IAzureAdapter {
  handler: HttpHandler;
  controller: ControllerType;
  private readonly corsConfig?: CORSConfig;
  private readonly trustProxy: boolean;
  /**
   * Creates an Azure Functions adapter with a root Helios controller.
   *
   * @param controller - Decorated controller class that handles incoming requests.
   */
  constructor(controller: ControllerClass, options?: AzureOptions) {
    super();
    if (options?.rbac?.getRoles) {
      setRolesExtractor(options.rbac.getRoles);
    }
    if (options?.fingerprint) {
      setFingerprintConfig(options.fingerprint);
    }
    this.corsConfig = options?.cors;
    this.trustProxy = options?.trustProxy ?? true;
    this.controller = this.compileController(controller);
    this.handler = this.createHandler();
  }

  private createHandler(): HttpHandler {
    return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
      // Clone before any hook runs: `HttpRequest`'s body can only be read
      // once, and a `beforeRequest` plugin may consume it (it receives the
      // same raw request) — reading from a pristine clone here keeps that
      // independent of whatever the plugin does.
      const bodyReq = req.clone();
      await this.callPluginHook('beforeRequest', req, context);

      let request: Request;
      try {
        request = await RequestFactory.create(bodyReq, context, this.trustProxy);
      } catch (error) {
        // Malformed JSON / bad body — reply before we have a Request.
        const status = (error as { status?: number })?.status ?? 400;
        return {
          status,
          headers: { 'X-Request-Id': context.invocationId },
          jsonBody: {
            code: (error as { code?: string })?.code ?? 'BAD_REQUEST',
            status,
            message: (error as Error)?.message ?? 'Bad Request',
          },
        };
      }
      const response = ResponseFactory.create(request);

      return this.runControllers(request, response);
    };
  }

  private compileController(ControllerClass: ControllerClass) {
    const prefix = '/';
    const meta: ControllerMeta = {
      prefix,
      routes: [],
      functions: [],
      name: 'root-handler',
      controllers: [],
    };

    return new ControllerClass(meta) as ControllerType;
  }

  private async runControllers(request: Request, response: Response): Promise<HttpResponseInit> {
    let processed;

    try {
      const controller = this.controller as unknown as IController;
      if (typeof controller[CONTROLLER_REQUEST] !== 'function') {
        throw new TypeError('Controller must have [HANDLE_REQUEST_HASH] method');
      }

      await this.callPluginHook('beforeRoute', request, response);

      processed = await controller[CONTROLLER_REQUEST](request, response);
    } catch (error: unknown) {
      return this.handleError(error as ErrorObject, request);
    }

    if (getErrorType(response?.data).isError) {
      return this.handleError(processed?.data, request);
    }

    return this.toAzureResponse(request, response);
  }

  private flattenHeaders(headers: Record<string, string | string[]>): [string, string][] {
    const entries: [string, string][] = [];
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const v of value) entries.push([key, v]);
      } else {
        entries.push([key, value]);
      }
    }
    return entries;
  }

  /** Applies the adapter-level CORS config, if any, before headers/status are read. */
  private applyCors(request: Request, response: Response): void {
    if (!this.corsConfig) return;
    const corsResult = handleCORS(request, response, this.corsConfig);
    if (!corsResult.permitted) {
      response.removeHeader('Access-Control-Allow-Origin');
    }
  }

  private encodeBody(response: Response): Buffer | string | undefined {
    const data = response.data;
    if (data == null) return undefined;
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  }

  private async toAzureResponse(request: Request, response: Response): Promise<HttpResponseInit> {
    this.applyCors(request, response);

    const status = (response.data as { status?: number })?.status ?? response?.status ?? 200;
    // `response.headers` already carries a default Content-Type from the Res
    // constructor in the common case — only fall back here if that's somehow
    // missing (e.g. `response.reset()` was called). Never add both: a real
    // Headers object comma-joins same-name entries instead of overwriting.
    const headers: [string, string][] = [['X-Request-Id', request.requestId]];
    if (!response.hasHeader('Content-Type')) headers.push(['Content-Type', 'application/json']);
    headers.push(...this.flattenHeaders(response.headers));
    for (const cookie of response.cookies ?? []) headers.push(['Set-Cookie', cookie]);

    const body = this.encodeBody(response);

    await this.callPluginHook('afterResponse', request, response);

    return { status, headers, body };
  }

  private async handleError(error: ErrorObject, request: Request): Promise<HttpResponseInit> {
    const config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
    };

    const serialized = new ApplicationError(error, {
      meta: request,
      config,
    });

    const status = serialized.status || 500;

    const tempResponse = ResponseFactory.create(request);
    this.applyCors(request, tempResponse);

    const headers: [string, string][] = [
      ['X-Request-Id', request.requestId],
      ...this.flattenHeaders(tempResponse.headers),
    ];

    await this.callPluginHook('afterResponse', request, tempResponse);

    return { status, headers, jsonBody: serialized };
  }
}
