import 'reflect-metadata';
import { CONTROLLER_CONFIG } from '../../constants';
import { ControllerMetadata, ControllerSubMetadata } from '../../types/core/controller';

export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export function reflectMeta(target: object, type?: 'direct'): ControllerMetadata;
export function reflectMeta(target: object, type: 'sub'): ControllerSubMetadata;
export function reflectMeta(
  target: object,
  type: 'sub' | 'direct' = 'direct',
): ControllerMetadata | ControllerSubMetadata {
  const data = Reflect.getMetadata(CONTROLLER_CONFIG, target) ?? {};

  if (type === 'sub') {
    ['use', 'catch', 'cors', 'sanitizers'].forEach((prop) => {
      if (!data[prop]?.length) {
        data[prop] = [];
      }
    });
    return data;
  }

  ['middlewares', 'controllers'].forEach((prop) => {
    if (!data[prop]?.length) {
      data[prop] = [];
    }
  });

  return data;
}
