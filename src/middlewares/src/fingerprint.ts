import type {
  FingerprintComponent,
  MiddlewareCB,
} from '@heliosjs/core/types';
import { defineMiddlewaresMeta, getOrComputeFingerprint } from '@heliosjs/core/utils';

export interface UseFingerprintOptions {
  components?: FingerprintComponent[];
}

/**
 * Controller/method decorator that computes the request fingerprint and attaches
 * it to request state (`getState('fingerprint')`) so downstream guards and
 * interceptors can read it. Non-blocking. Optional `components` overrides the
 * configured/default component set for this scope.
 *
 * @example
 * @UseFingerprint()
 * class MyController {}
 */
export function UseFingerprint(options: UseFingerprintOptions = {}) {
  const middleware: MiddlewareCB = (req, _res, next) => {
    getOrComputeFingerprint(req, options.components);
    return next();
  };

  return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
    const data = [{ middleware }];
    if (propertyKey) {
      defineMiddlewaresMeta(data, target, propertyKey);
    } else {
      defineMiddlewaresMeta(data, target);
    }
    return target;
  };
}
