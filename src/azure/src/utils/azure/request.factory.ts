import type { IRequestFactory } from '@heliosjs/core/types';
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

// Compile-time-only check that RequestFactory's static side conforms to the
// shared IRequestFactory contract (see its doc comment in @heliosjs/core) —
// `implements` doesn't reach static members, so this is the idiom instead.
// Unused-by-design (prefixed `_` per this repo's convention for that).
const _requestFactoryShape: IRequestFactory<Parameters<typeof RequestFactory.create>> =
  RequestFactory;
