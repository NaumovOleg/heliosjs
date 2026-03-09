import { INTERCEPTOR, SERVER_CONFIG_KEY } from '@constants';
import { ErrorCB, InterceptorCB } from '@types';

export function Intercept(interceptor: InterceptorCB) {
  return function (target: any) {
    const interceptors = Reflect.getMetadata(INTERCEPTOR, target) ?? [];

    interceptors.push(interceptor);
    console.log('=========', interceptor);
    Reflect.defineMetadata(INTERCEPTOR, interceptors, target);

    return target;
  };
}

export function Catch(handler: ErrorCB) {
  return function (target: any) {
    Reflect.defineMetadata(SERVER_CONFIG_KEY, handler, target);

    return target;
  };
}
