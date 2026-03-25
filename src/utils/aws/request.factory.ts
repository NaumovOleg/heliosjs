// core/RequestFactory.ts
import { Context } from 'aws-lambda';
import { LambdaEvent } from '../../types/aws';
import { Req } from '../core/request';
import { normalizeEvent } from './lambda.event.normalizers';

export class RequestFactory {
  static create(event: LambdaEvent, context: Context): Req {
    return new Req(normalizeEvent(event, context));
  }
}
