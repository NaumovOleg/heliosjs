import { TO_VALIDATE } from '../../constants';
import { ErrorCode } from '../../types/core';
import type {
  Route,
  MiddlewaresMetadataItem,
  CompiledMiddleware,
  ControllerInstance,
  ControllerMeta,
  GuardClass,
  GuardFunction,
  GuardInstance,
  Request,
  Response,
} from '../../types/core';
import type { ErrorHandler } from '../../types/core/error';
import { reflectMiddlewaresMetadata, reflectRouteMetadata, validate } from '../shared';
import { WebSocketService } from '../socket';
import { SSEService } from '../sse';
import { handleCORS } from './cors';
import { getOrComputeFingerprint } from './fingerprint';
import { ForbiddenError } from './error';
import { getHeaderCI } from './headers';
import { getBodyAndMultipart } from './helper';
import { enforceRateLimit } from './ratelimit';
import { extractRouteParams, routeSpecificity } from './match';
import { getGlobalLogger } from './logger';
import { sanitizeRequest } from './sanitize';

/**
 * Error codes that resolve to their own HTTP response and bypass `@Catch`
 * handlers — but only when the route declares no error handler of its own.
 */
export const SKIP_ERROR_HANDLER_CODES: (ErrorCode | undefined)[] = [
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.UNAUTHORIZED,
];

/**
 * Runs error handlers newest-first, stopping at the first that returns a
 * non-Error value (which becomes `response.data`). Returns true when a handler
 * produced such a value, false when every handler re-threw or returned an Error.
 */
async function runErrorHandlers(
  handlers: (ErrorHandler | undefined)[],
  error: unknown,
  request: Request,
  response: Response
): Promise<boolean> {
  let caught: unknown = error;
  for (const handler of handlers) {
    const resp = await Promise.resolve(handler?.(caught as Error, request, response)).catch(
      (err) => err
    );
    caught = resp;
    if (!(resp instanceof Error)) {
      response.data = caught;
      return true;
    }
  }
  return false;
}

/**
 * @internal Runs the full per-route pipeline for an already-matched route: CORS,
 * `beforeRequest` (rate limit, sanitizers, guards, pipes, middlewares), param
 * resolution + validation, the handler, interceptors (reverse order), and error
 * handling (`@Catch`, or the self-resolving 401/403/404/429 codes). Mutates and
 * returns `response`. This is the request pipeline itself — adapters call it per
 * matched route; app code never calls it directly.
 */
export const execute = async (
  route: Route,
  request: Request,
  response: Response,
  precomputedParams?: Record<string, string>
) => {
  // The request pipeline (descriptors/request.ts) already matched this exact
  // route via `findRoute` and hands back its params, so it can skip a second
  // regex exec here. Direct `execute()` callers (tests, other adapters) don't
  // have that, so they still get params derived the old way.
  request.params = precomputedParams ?? extractRouteParams(route, request.path);

  // `route.compiled` is set for every real route; derive it for hand-built ones.
  const compiled = route.compiled ?? buildCompiledMiddleware(route.functions);

  const corsConfigs = compiled.cors.length ? compiled.cors : route.cors ?? [];

  const handledCors = corsConfigs.reduce(
    (acc, conf) => {
      const cors = handleCORS(request, response, conf);
      return {
        permitted: acc.permitted && cors.permitted,
        continue: acc.continue && cors.continue,
      };
    },
    { permitted: true, continue: true }
  );

  if (!handledCors.permitted) {
    response.status = 403;
    response.error(new ForbiddenError('Cors not permitted'));
    return response;
  }

  if (!handledCors.continue && handledCors.permitted) {
    response.status = 204;
    return response;
  }

  try {
    // beforeRequest() is a guaranteed no-op when the route has no
    // sanitizers/guards/pipes/middlewares/rateLimits — skip the call (and its
    // `await`) rather than pay a microtask hop to run zero-length loops.
    const handled = compiled.hasBeforeRequestWork
      ? await beforeRequest(request, response, route)
      : false;

    if (handled) {
      return response;
    }

    // Only parse multipart / re-derive body when a param actually needs it.
    const wantsBody = route.parameters.some(
      (p) => p.type === 'body' || p.type === 'multipart'
    );
    const { body, multipart } = wantsBody
      ? getBodyAndMultipart(request)
      : { body: request.body, multipart: undefined };

    const args: unknown[] = [];

    const byIndex: (Route['parameters'][number] | undefined)[] = [];
    let totalParams = 0;
    for (const p of route.parameters) {
      byIndex[p.index] = p;
      if (p.index + 1 > totalParams) totalParams = p.index + 1;
    }

    for (let i = 0; i < totalParams; i++) {
      const param = byIndex[i];

      if (!param) {
        args[i] = undefined;
        continue;
      }

      let value = request[param.type as keyof Request];

      if (param.type === 'multipart') {
        value = multipart;
      }
      if (param.type === 'ws') {
        value = WebSocketService.getInstance();
      }
      if (param.type === 'sse') {
        value = SSEService.getInstance();
      }
      if (param.type === 'request') {
        value = request;
      }
      if (param.type === 'body') {
        value = body;
      }
      if (param.type === 'response') {
        value = response;
      }
      if (param.type === 'fingerprint') {
        value = getOrComputeFingerprint(request);
      }

      if (TO_VALIDATE.includes(param.type)) {
        const validated = await validate(param.dto, value, param.options);

        if (!param.name) {
          value = validated;
        } else if (param.type === 'headers') {
          // Header names are case-insensitive.
          value = getHeaderCI(validated as Record<string, string | string[]>, param.name);
        } else {
          value = (validated as Record<string, unknown> | undefined)?.[param.name];
        }
      }

      args[i] = value;
    }
    if (args.length === 0) {
      args.push(request, response);
    }

    // Only await when the result actually looks like a promise/thenable —
    // matches what `Promise.resolve(x)` would unwrap anyway, but skips a
    // microtask hop for the common case of a handler returning a plain value.
    const result = route.fn(...args);
    let data =
      result && typeof (result as PromiseLike<unknown>).then === 'function'
        ? await result
        : result;

    const isError = data instanceof Error;

    if (isError) {
      // `error()` already serialised and stored the payload — don't re-wrap it.
      response.error(data);
      return response;
    }

    if (!response.isRedirect) {
      response.status = compiled.status ?? 200;
    }
    const { interceptors } = compiled;
    for (let i = interceptors.length - 1; i >= 0; i--) {
      data = await Promise.resolve(interceptors[i](data, request, response));
    }

    response.data = data;

    return response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const handlers = [...compiled.errorHandlers].reverse();

    // Errors with these codes carry their own HTTP semantics; skip @Catch only
    // when the route has no explicit error handler to override them.
    if (handlers.length === 0 && SKIP_ERROR_HANDLER_CODES.includes(error?.code)) {
      response.error(error);
      return response;
    }

    if (handlers.length > 0) {
      if (await runErrorHandlers(handlers, error, request, response)) return response;
      // handlers ran but every one re-threw / returned an Error
      response.error(error);
      return response;
    }

    // No handler and not a self-resolving code: an Error propagates. A raw
    // non-Error throw has no message/stack to rethrow usefully (historical
    // behaviour keeps it from crashing the process) but is logged so it isn't
    // silently lost.
    if (error instanceof Error) throw error;
    getGlobalLogger().error('Non-Error value thrown with no @Catch handler', error);
    return response;
  }
};

/** @internal Returns every method name (own + inherited, excluding `constructor`) walking `obj`'s prototype chain. */
export const getAllMethods = (obj: unknown): string[] => {
  const methods = new Set<string>();
  let current = Object.getPrototypeOf(obj);

  while (current && current !== Object.prototype) {
    Object.getOwnPropertyNames(current).forEach((name) => {
      if (name !== 'constructor' && typeof current[name] === 'function') {
        methods.add(name);
      }
    });
    current = Object.getPrototypeOf(current);
  }

  return Array.from(methods);
};

/** @internal Default middleware `next()` implementation: re-throws when called with an error. */
export const NextFunction = (error?: Error) => {
  if (error) throw error;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isGuardInstance(guard: any): guard is GuardInstance {
  return typeof guard === 'object' && guard !== null && typeof guard.canActivate === 'function';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isGuardClass(guard: any): guard is GuardClass {
  return (
    typeof guard === 'function' &&
    guard.prototype &&
    typeof guard.prototype.canActivate === 'function'
  );
}

/**
 * @internal Runs one guard (instance, class, or function) against the request
 * and throws `ForbiddenError` when it denies. Used by `beforeRequest` for every
 * compiled guard; the `@Guard`/`@Roles` decorators are the app-facing surface.
 */
export async function runGuard(
  guard: GuardInstance | GuardClass | GuardFunction,
  request: Request,
  response: Response
) {
  let canActivate;
  let message = 'Forbidden';
  if (isGuardInstance(guard)) {
    canActivate = await guard.canActivate(request, response);
    if (typeof canActivate === 'string') {
      message = canActivate;
      canActivate = false;
    } else {
      message = guard.message ?? message;
    }
  } else if (isGuardClass(guard)) {
    const guardInstance = new guard();
    canActivate = await guardInstance.canActivate(request, response);
    if (typeof canActivate === 'string') {
      message = canActivate;
      canActivate = false;
    } else {
      message = guardInstance.message ?? message;
    }
  } else {
    const result = await guard(request, response);
    if (typeof result === 'string') {
      canActivate = false;
      message = result;
    } else {
      canActivate = result;
    }
  }
  if (!canActivate) {
    throw new ForbiddenError(message);
  }
}

/**
 * @internal Runs the pre-handler stages for one route in order: rate limit,
 * sanitizers, guards, pipes, middlewares. Errors are routed through the route's
 * `@Catch` handlers when present. Returns `true` when an error handler already
 * produced a response (caller should stop), `false` to continue to the handler.
 */
export const beforeRequest = async (
  request: Request,
  response: Response,
  route: Route
): Promise<boolean> => {
  const compiled = route.compiled ?? buildCompiledMiddleware(route.functions);

  // Routes precompile their rateLimit items into `compiled.rateLimits` already
  // (see buildCompiledMiddleware below); reuse that instead of re-scanning
  // `route.functions` on every request.
  await enforceRateLimit(request, response, route, compiled.rateLimits);

  try {
    for (const sanitizer of compiled.sanitizers) {
      sanitizeRequest(request, sanitizer);
    }

    for (const guard of compiled.guards) {
      await runGuard(guard, request, response);
    }

    for (const pipe of compiled.pipes) {
      if (pipe.body) {
        request.body = pipe.body(request.body, request);
      }
      if (pipe.query) {
        request.query = pipe.query(request.query, request);
      }
      if (pipe.params) {
        request.params = pipe.params(request.params, request);
      }
      if (pipe.headers) {
        request.headers = pipe.headers(request.headers, request);
      }
    }

    for (const mw of compiled.middlewares) {
      await mw(request, response, NextFunction);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (compiled.errorHandlers.length === 0) throw err;
    const ordered = [...compiled.errorHandlers].reverse();
    if (await runErrorHandlers(ordered, err, request, response)) return true;
    throw err;
  }
  return false;
};

/**
 * @internal Builds the {@link Route}s for one controller instance: reads each
 * method's decorator metadata, joins the prefix, merges inherited (`meta`)
 * middlewares ahead of the controller's own, and precompiles the regex, param
 * extractor, and middleware chain. Called by `CONTROLLER_META` while
 * constructing a `@Controller`-wrapped class; not called directly by app code.
 */
export function collectRoutes(
  instance: ControllerInstance,
  meta: Omit<ControllerMeta, 'controllers'>,
  prefix = '/'
) {
  const propertyNames = getAllMethods(instance.constructor.prototype);

  const routes: Route[] = [];

  for (const name of propertyNames) {
    const functions = reflectMiddlewaresMetadata(instance, name);
    const routeMeta = reflectRouteMetadata(instance, name);

    const current = [prefix, routeMeta.route].join('/').replace(/\/+/g, '/');
    const routeMiddlewares = routeMeta.middlewares?.map?.((middleware) => ({ middleware })) ?? [];

    // Route-array middlewares (`@Get('/', [a, b])`) run before method-level
    // decorators, in the order given.
    functions.unshift(...routeMiddlewares);

    const allFunctions = [...meta.functions, ...functions];
    const corsConfigs = allFunctions
      .filter((fn) => fn.cors)
      .map((fn) => fn.cors as NonNullable<typeof fn.cors>);

    const compiledRegex = compileRouteRegex(current);

    routes.push({
      ...routeMeta,
      name,
      route: current,
      cors: corsConfigs.length > 0 ? corsConfigs : undefined,
      functions: allFunctions,
      fn: instance[name].bind(instance),
      compiledRegex,
      compiledSegments: current.split('/').filter((s) => s.length > 0),
      specificity: routeSpecificity(current),
      compiled: buildCompiledMiddleware(allFunctions),
    });
  }

  return routes;
}

function compileRouteRegex(route: string): RegExp | undefined {
  const segments = route.split('/').filter((s) => s.length > 0);
  let pattern = '^';
  segments.forEach((seg, i) => {
    if (seg === '*') {
      // A trailing `*` captures the remaining path (exposed as @Params('*'));
      // a mid-route `*` only matches, it captures nothing.
      pattern += i === segments.length - 1 ? '(?:/(.*))?' : '.*';
      return;
    }
    const regexMatch = seg.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)\((.+)\)$/);
    if (regexMatch) {
      pattern += '/(' + regexMatch[2] + ')';
    } else if (seg.endsWith('?')) {
      pattern += '(?:/([^/]+))?';
    } else if (seg.startsWith(':')) {
      pattern += '/([^/]+)';
    } else {
      pattern += '/' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  });
  pattern += '/?$';
  return new RegExp(pattern);
}

function buildCompiledMiddleware(fns: MiddlewaresMetadataItem[]): CompiledMiddleware {
  const compiled: CompiledMiddleware = {
    sanitizers: [],
    guards: [],
    pipes: [],
    middlewares: [],
    interceptors: [],
    errorHandlers: [],
    cors: [],
    rateLimits: [],
    hasBeforeRequestWork: false,
  };

  for (const fn of fns) {
    if (fn.sanitizer) compiled.sanitizers.push(fn.sanitizer);
    if (fn.guard) compiled.guards.push(fn.guard);
    if (fn.pipe) compiled.pipes.push(fn.pipe);
    if (fn.middleware) compiled.middlewares.push(fn.middleware);
    if (fn.interceptor) compiled.interceptors.push(fn.interceptor);
    if (fn.errorHandler) compiled.errorHandlers.push(fn.errorHandler);
    if (fn.cors) compiled.cors.push(fn.cors);
    if (fn.rateLimit) compiled.rateLimits.push(fn.rateLimit);
    if (fn.status !== undefined) compiled.status = fn.status;
  }

  compiled.hasBeforeRequestWork =
    compiled.sanitizers.length > 0 ||
    compiled.guards.length > 0 ||
    compiled.pipes.length > 0 ||
    compiled.middlewares.length > 0 ||
    compiled.rateLimits.length > 0;

  return compiled;
}
