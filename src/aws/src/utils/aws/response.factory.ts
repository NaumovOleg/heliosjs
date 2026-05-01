// core/ResponseFactory.ts
import { Meta } from '@heliosjs/core/types';
import { Res } from '@heliosjs/core/utils';

export class ResponseFactory {
  /**
   * Create Response for Lambda
   */
  static create(meta: Meta): Res {
    return new Res('lambda', meta, meta);
  }
}
