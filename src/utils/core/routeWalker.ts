import {
  CATCH,
  CONTROLLERS,
  CORS_METADATA,
  INTERCEPTOR,
  MIDDLEWARES,
  ROUTE_PREFIX,
  SANITIZE,
  USE_MIDDLEWARE,
} from '../../constants';
import { Request, Response, RouteContext } from '../../types/core';
import { applyMiddlewaresVsSanitizers, findRouteInController, getResponse } from './controller';
import { handleCORS } from './cors';
import { pathStartsWithPrefix } from './endpoint';

export const routeWalker = async (
  context: RouteContext,
  request: Request,
  response: Response,
): Promise<any> => {
  const { controllerInstance, controllerMeta, path, method, subPath } = context;

  for (const SubController of controllerMeta.subControllers) {
    const subInstance = new SubController();

    const middlewares = []
      .concat(Reflect.getMetadata(MIDDLEWARES, SubController.prototype))
      .concat(Reflect.getMetadata(USE_MIDDLEWARE, SubController))
      .filter((el) => !!el);

    const sanitizers = []
      .concat(Reflect.getMetadata(SANITIZE, SubController.prototype))
      .concat(Reflect.getMetadata(SANITIZE, SubController))
      .filter((el) => !!el);

    const subMeta = {
      routePrefix: Reflect.getMetadata(ROUTE_PREFIX, SubController.prototype) || '',
      middlewares,
      interceptor: Reflect.getMetadata(INTERCEPTOR, SubController.prototype),
      errorHandler: Reflect.getMetadata(CATCH, SubController),
      subControllers: Reflect.getMetadata(CONTROLLERS, SubController.prototype) || [],
      cors: Reflect.getMetadata(CORS_METADATA, SubController.prototype) || [],
      sanitizers,
    };

    const fullSubPath = [subPath, subMeta.routePrefix]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');

    if (pathStartsWithPrefix(path, fullSubPath)) {
      const walkerData = {
        ...context,
        subPath: fullSubPath,
        controllerInstance: subInstance,
        controllerMeta: subMeta,
        path,
        middlewareChain: [...context.middlewareChain, ...controllerMeta.middlewares],
        sanitizersChain: [...context.sanitizersChain, ...controllerMeta.sanitizers],
        errorHandlerChain: [...context.errorHandlerChain, subMeta.errorHandler].filter(
          (el) => !!el,
        ),
        interceptorChain: [...context.interceptorChain, controllerMeta.interceptor].filter(
          (el) => !!el,
        ),
        corsChain: [...context.corsChain, subMeta.cors].filter((el) => !!el),
      };

      return routeWalker(walkerData, request, response);
    }
  }

  const routeMatch = findRouteInController(controllerInstance, subPath, path, method);

  if (!routeMatch) {
    return false;
  }

  try {
    const { name, pathParams, middlewares, cors, sanitizers } = routeMatch;
    Object.assign(request, { params: pathParams });

    const handledCors = context.corsChain
      .concat(cors ?? [])
      .flat()
      .filter((el) => !!el)
      .reduce(
        (acc, conf) => {
          const cors = handleCORS(request, response, conf);
          return {
            permitted: acc.permitted && cors.permitted,
            continue: acc.continue && cors.continue,
          };
        },
        { permitted: true, continue: true },
      );

    if (!handledCors.permitted) {
      response.status = 403;
      response.data = 'Cors not pemitted';
      return true;
    }
    if (!handledCors.continue && handledCors.permitted) {
      response.status = 204;
      return true;
    }

    const controllerMiddlewares = [...context.middlewareChain, ...controllerMeta.middlewares];

    const controllerSanitizers = [...context.sanitizersChain, ...controllerMeta.sanitizers].filter(
      (el) => !!el,
    );

    await applyMiddlewaresVsSanitizers(request, response, {
      sanitizers: [controllerSanitizers, sanitizers],
      middlewares: [controllerMiddlewares, middlewares],
    });

    const data = await getResponse({
      interceptors: [...context.interceptorChain, controllerMeta.interceptor].filter((el) => !!el),
      controllerInstance,
      name,
      response: response,
      request: request,
    });
    if (response.data instanceof Error) {
      throw data;
    }
    response.data = data;
    return true;
  } catch (error: any) {
    let catched = error;
    const statusCode = error.status ?? error.statusCode ?? 500;
    catched.status = statusCode;

    response.error(error);

    for (const handler of context.errorHandlerChain?.reverse() || []) {
      try {
        catched = await handler(catched, request, response);
        response.status = 200;

        response.data = catched;
      } catch (errs: any) {
        response.status = errs.status ?? errs.statusCode ?? statusCode;
        response.error(new Error(errs));
      }
    }
  }

  return true;
};
