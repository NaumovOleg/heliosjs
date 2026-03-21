// core/RequestFactory.ts
import { Context } from 'aws-lambda';
import { LambdaEvent } from '../../types/aws';
import { Req } from '../core/request';
import { normalizeEvent } from './lambda.event.normalizers';

export class RequestFactory {
  static create(event: LambdaEvent, context: Context): Req {
    // Detect event type
    const normalized = normalizeEvent(event, context);
    return new Req(normalized);
  }
}
