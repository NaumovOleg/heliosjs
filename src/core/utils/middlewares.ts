import { CATCH, USE_MIDDLEWARE } from '@constants';
import { ErrorCB, MiddlewareCB } from '@types';

export function Use(middleware: MiddlewareCB | MiddlewareCB[]) {
  return function (target: any) {
    const existed = Reflect.getMetadata(USE_MIDDLEWARE, target) || [];

    Reflect.defineMetadata(USE_MIDDLEWARE, existed.concat(middleware).reverse(), target);

    return target;
  };
}

export function Catch(handler: ErrorCB) {
  return function (target: any) {
    Reflect.defineMetadata(CATCH, handler, target);

    return target;
  };
}
