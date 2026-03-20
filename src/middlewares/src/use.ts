import { USE_MIDDLEWARE } from './constants';
import { MiddlewareCB } from './types/core';

export function Use(middleware: MiddlewareCB | MiddlewareCB[]) {
  return function (target: any) {
    const existed = Reflect.getMetadata(USE_MIDDLEWARE, target) || [];

    Reflect.defineMetadata(USE_MIDDLEWARE, existed.concat(middleware).reverse(), target);

    return target;
  };
}
