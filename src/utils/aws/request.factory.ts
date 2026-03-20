// core/RequestFactory.ts
import { Context } from 'aws-lambda';
import { LambdaEvent } from '../../types/aws';
import { Request } from '../core/request';
import { normalizeEvent } from './lambda.event.normalizers';

export class RequestFactory {
  static create(event: LambdaEvent, context: Context): Request {
    // Detect event type
    const normalized = normalizeEvent(event, context);
    return new Request(normalized);
  }
}
