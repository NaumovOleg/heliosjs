import { CATCH } from './constants';
import { ErrorCB } from './types/core';

export function Catch(handler: ErrorCB) {
  return function (target: any) {
    Reflect.defineMetadata(CATCH, handler, target);

    return target;
  };
}
