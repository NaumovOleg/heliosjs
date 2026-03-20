// core/ResponseFactory.ts
import { ServerResponse } from 'http';
import { Meta } from '../../types/core';
import { Response } from '../core/response';

export class ResponseFactory {
  /**
   * Create Response for HTTP server
   */
  static create(res: ServerResponse, meta: Meta): Response {
    return new Response('http', meta, res);
  }
}
