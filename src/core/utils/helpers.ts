import { OK_METADATA_KEY } from '@constants';

export function Status(status: number) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>,
  ): void {
    if (!propertyKey) {
      Reflect.defineMetadata(OK_METADATA_KEY, status, target.prototype || target);
      return;
    }

    if (descriptor) {
      Reflect.defineMetadata(OK_METADATA_KEY, status, target, propertyKey);
    }
  };
}

export const Ok200 = () => Status(200);
export const Ok201 = () => Status(201);
export const Ok204 = () => Status(204);
