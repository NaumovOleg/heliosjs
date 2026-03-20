import { SANITIZE } from './constants';
import { SanitizerConfig } from './types/core';

export function Sanitize(sanitizeConfig: SanitizerConfig | SanitizerConfig[]) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const configs = Array.isArray(sanitizeConfig) ? sanitizeConfig : [sanitizeConfig];

    if (propertyKey && descriptor) {
      Reflect.defineMetadata(SANITIZE, configs, target, propertyKey);
    } else {
      Reflect.defineMetadata(SANITIZE, configs, target.prototype || target);
    }
  };
}
