import type { Request, Response, IController } from '../types/core';
import { CONTROLLER_PRECOMPILED } from '../constants';
import { execute, findRoute, NotFoundError } from '../utils/core';

export const request = async function (this: IController, request: Request, response: Response) {
  const matched = findRoute(this[CONTROLLER_PRECOMPILED], request.path, request.method);

  if (!matched) {
    response.error(new NotFoundError(`Route ${request.url} not found`));
    return null;
  }

  return execute(matched.route, request, response, matched.params);
};
