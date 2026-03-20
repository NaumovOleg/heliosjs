// core/ResponseFactory.ts
import { Meta } from '../../types/core';
import { Response } from '../core/response';

export class ResponseFactory {
  /**
   * Create Response for Lambda
   */
  static create(meta: Meta): Response {
    return new Response('lambda', meta);
  }
}
