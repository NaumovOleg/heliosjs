import type { FingerprintComponent, MiddlewareCB } from '@heliosjs/core/types';
import { defineMiddlewaresMeta, getOrComputeFingerprint } from '@heliosjs/core/utils';

/** Options for `@UseFingerprint`. */
export interface UseFingerprintOptions {
  /** Component set to hash for this scope, overriding the configured/default set. See {@link FingerprintComponent}. */
  components?: FingerprintComponent[];
}

/**
 * Controller/method decorator that computes the request fingerprint and attaches
 * it to request state (`getState('fingerprint')`) so downstream interceptors,
 * pipes, and the handler can read it. This tags itself as a `middleware`
 * item, which the request pipeline runs *after* guards — a guard reading
 * `getState('fingerprint')` will not see a value set here (rate limiting,
 * which runs before guards, computes its own fingerprint independently for
 * its own key). Non-blocking. Optional `components` overrides the
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
