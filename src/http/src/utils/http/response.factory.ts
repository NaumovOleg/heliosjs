// core/ResponseFactory.ts

import type { ServerResponse } from 'node:http';
import type { Meta } from '@heliosjs/core/types';
import { Res } from '@heliosjs/core/utils';

export class ResponseFactory {
  /**
   * Create Response for HTTP server
   */
  static create(res: ServerResponse, meta: Meta): Res {
    return new Res('http', meta, res);
  }
}
