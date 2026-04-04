import { CONTROLLER_CONFIG } from './constants';
import { MiddlewareCB } from './types/core';
import { reflectMeta } from './utils/shared';

export function Use(middleware: MiddlewareCB | MiddlewareCB[]) {
  return function (target: any) {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];

    const meta = reflectMeta(target, 'sub');
    meta.use.push(...middlewares);
    Reflect.defineMetadata(CONTROLLER_CONFIG, meta, target);

    return target;
  };
}
