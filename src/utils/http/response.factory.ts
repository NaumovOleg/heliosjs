// core/ResponseFactory.ts
import { ServerResponse } from 'http';
import { Meta } from '../../types/core';
import { Res } from '../core/response';

export class ResponseFactory {
  /**
   * Create Response for HTTP server
   */
  static create(res: ServerResponse, meta: Meta): Res {
    return new Res('http', meta, res);
  }
}
