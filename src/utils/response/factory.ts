// core/ResponseFactory.ts
import { Meta } from '@types';
import { ServerResponse } from 'http';
import { Response } from './response';

export class ResponseFactory {
  /**
   * Create Response for HTTP server
   */
  static forHttp(res: ServerResponse, meta: Meta): Response {
    return new Response('http', meta, res);
  }

  /**
   * Create Response for Lambda
   */
  static forLambda(meta: Meta): Response {
    return new Response('lambda', meta);
  }
}
