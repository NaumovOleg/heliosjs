import type { Meta } from '@heliosjs/core/types';
import { Res } from '@heliosjs/core/utils';

export class ResponseFactory {
  /**
   * Create Response for Azure Functions
   */
  static create(meta: Meta): Res {
    return new Res('azure', meta, meta);
  }
}
