import type { Request, Response, IController } from '../types/core';
import { CONTROLLER_PRECOMPILED } from '../constants';
import { execute, matchRoutes, NotFoundError } from '../utils/core';

export const request = async function (this: IController, request: Request, response: Response) {
  const matched = matchRoutes(this[CONTROLLER_PRECOMPILED], request.url, request.method);

  if (!matched) {
    response.error(new NotFoundError(`Route ${request.url} not found`, request.requestId));
    return null;
  }

  return execute(matched, request, response);
};
