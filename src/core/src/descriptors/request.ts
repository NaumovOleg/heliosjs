import type { Request, Response, IController } from '../types/core';
import { execute, matchRoutes, NotFoundError } from '../utils/core';

export const request: IController['request'] = async function (
  this: IController,
  request: Request,
  response: Response
) {
  const matched = matchRoutes(this.precompiled, request.url, request.method);

  if (!matched) {
    return response.error(new NotFoundError(`Route ${request.url} not found`, request.requestId));
  }

  return execute(matched, request, response);
};
