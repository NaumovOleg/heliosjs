import { Req } from '@heliosjs/core/utils';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import { normalizeAzureRequest } from './request.normalizer';

export class RequestFactory {
  static async create(
    req: HttpRequest,
    context: InvocationContext,
    trustProxy = true
  ): Promise<Req> {
    return new Req({ ...(await normalizeAzureRequest(req, context)), trustProxy });
  }
}
