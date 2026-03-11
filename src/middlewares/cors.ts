import { CORS_METADATA } from '@constants';
import { CORSConfig, HTTP_METHODS } from '@types';

export function Cors(config: CORSConfig = {}) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const defaultConfig: CORSConfig = {
      origin: '*',
      optionsSuccessStatus: 204,
      methods: Object.keys(HTTP_METHODS),
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (propertyKey && descriptor) {
      Reflect.defineMetadata(CORS_METADATA, finalConfig, target, propertyKey);
    } else {
      Reflect.defineMetadata(CORS_METADATA, finalConfig, target.prototype || target);
    }
  };
}
