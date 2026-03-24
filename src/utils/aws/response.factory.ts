// core/ResponseFactory.ts
import { Meta } from '../../types/core';
import { Res } from '../core/response';

export class ResponseFactory {
  /**
   * Create Response for Lambda
   */
  static create(meta: Meta): Res {
    return new Res('lambda', meta, meta);
  }
}
