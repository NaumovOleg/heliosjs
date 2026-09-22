// core/RequestFactory.ts

import type { IRequestFactory } from '@heliosjs/core/types';
import { Req } from '@heliosjs/core/utils';
import type { Context } from 'aws-lambda';
import type { LambdaEvent } from '../../types/aws';
import { normalizeEvent } from './lambda.event.normalizers';

export class RequestFactory {
  static create(event: LambdaEvent, context: Context, trustProxy = true): Req {
    return new Req({ ...normalizeEvent(event, context), trustProxy });
  }
}

// Compile-time-only check that RequestFactory's static side conforms to the
// shared IRequestFactory contract (see its doc comment in @heliosjs/core) —
// `implements` doesn't reach static members, so this is the idiom instead.
// Unused-by-design (prefixed `_` per this repo's convention for that).
const _requestFactoryShape: IRequestFactory<Parameters<typeof RequestFactory.create>> =
  RequestFactory;
